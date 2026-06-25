const express = require('express');
const cors = require('cors');
const app = express()
require('dotenv').config()
const port = 5000

app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

app.get('/', (req, res) => {
  res.send('Hello World!')
})


const uri = process.env.MONGO_DB_URI;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const database = client.db("ticket-bari");
    const ticketCollection = database.collection("tickets");
    const userCollection = database.collection("user");
    const bookingCollection = database.collection("bookings");



    app.post("/api/tickets", async (req, res) => {
      const ticket = req.body;
      const vendor = await userCollection.findOne({
        email: ticket.vendorEmail,
      });
      if (vendor?.isFraud) {
        return res.status(403).send({
          message: "Fraud vendors cannot add tickets",
        });
      }
      const result = await ticketCollection.insertOne({
        ...ticket,
        status: "pending",
        hidden: false,
        createdAt: new Date(),
      });
      res.send(result);
    });

    app.get("/api/users", async (req, res) => {
      const users = await userCollection.find({}).toArray();
      res.send(users);
    });

    app.get("/api/users/:id", async (req, res) => {
      try {
        const user = await userCollection.findOne({
          _id: new ObjectId(req.params.id),
        });
        res.send(user);
      } catch (e) {
        res.status(500).send({ message: e.message });
      }
    });

    app.put("/api/users/:id", async (req, res) => {
      try {
        const { name, image } = req.body;
        const result = await userCollection.updateOne(
          { _id: new ObjectId(req.params.id) },
          { $set: { name, image, updatedAt: new Date() } }
        );
        res.send(result);
      } catch (e) {
        res.status(500).send({ message: e.message });
      }
    });

    app.patch("/api/users/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const { role, isFraud } = req.body;
        const updateDoc = {};

        if (role) {
          updateDoc.role = role;
        }
        if (typeof isFraud === "boolean") {
          updateDoc.isFraud = isFraud;
        }
        const user = await userCollection.findOne({
          _id: new ObjectId(id),
        });
        if (!user) {
          return res.status(404).send({
            message: "User not found",
          });
        }
        const result = await userCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updateDoc }
        );

        if (isFraud === true) {
          await ticketCollection.updateMany(
            { vendorEmail: user.email },
            {
              $set: {
                hidden: true,
                isFraudVendor: true,
              },
            }
          );
        }
        if (isFraud === false) {
          await ticketCollection.updateMany(
            { vendorEmail: user.email },
            {
              $set: {
                hidden: false,
                isFraudVendor: false,
              },
            }
          );
        }
        res.send(result);
      } catch (error) {
        res.status(500).send({
          message: error.message,
        });
      }
    });


    app.get('/api/tickets', async (req, res) => {
      try {
        const query = {};
        if (req.query.vendorEmail) {
          query.vendorEmail = req.query.vendorEmail;
        }
        if (req.query.status) {
          query.status = req.query.status;
        }
        query.hidden = { $ne: true };

        const result = await ticketCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: error.message });
      }
    });


    app.get("/api/advertisements", async (req, res) => {
      try {
        const result = await ticketCollection
          .find({
            status: "approved",
            isAdvertised: true,
            hidden: { $ne: true },
          })
          .sort({ updatedAt: -1 })
          .limit(6)
          .toArray();

        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to get advertisements" });
      }
    });

    app.patch("/api/tickets/:id/advertise", async (req, res) => {
      try {
        const id = req.params.id;
        const { isAdvertised } = req.body;

        const ticket = await ticketCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!ticket) {
          return res.status(404).send({ message: "Ticket not found" });
        }

        if (ticket.status !== "approved") {
          return res.status(400).send({
            message: "Only approved tickets can be advertised",
          });
        }

        if (isAdvertised) {
          const count = await ticketCollection.countDocuments({
            status: "approved",
            isAdvertised: true,
          });

          if (count >= 6) {
            return res.status(400).send({
              message: "Maximum 6 tickets can be advertised",
            });
          }
        }

        const result = await ticketCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              isAdvertised,
              updatedAt: new Date(),
            },
          }
        );

        res.send(result);
      } catch (error) {
        res.status(500).send({ message: error.message });
      }
    });

    app.get("/api/latest-tickets", async (req, res) => {
      try {
        const tickets = await ticketCollection
          .find({
            status: "approved",
            hidden: { $ne: true },
          })
          .sort({ createdAt: -1 })
          .limit(8)
          .toArray();

        res.send(tickets);
      } catch (error) {
        res.status(500).send({ message: error.message });
      }
    });

    app.get("/api/tickets/:id", async (req, res) => {
      const id = req.params.id;
      const result = await ticketCollection.findOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    app.put("/api/tickets/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const result = await ticketCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              ...req.body,
              status: "pending",
              updatedAt: new Date(),
            },
          }
        );
        res.send(result);
      } catch (e) {
        res.status(500).send({ message: e.message });
      }
    });

    app.patch("/api/tickets/:id/status", async (req, res) => {
      const { id } = req.params;
      const { status } = req.body;

      const result = await ticketCollection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: { status },
        }
      );

      res.send(result);
    });

    app.delete("/api/tickets/:id", async (req, res) => {
      const id = req.params.id;
      const result = await ticketCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    app.post("/api/bookings", async (req, res) => {
      const booking = {
        ...req.body,
        status: "pending",
        createdAt: new Date(),
      };
      const result = await bookingCollection.insertOne(booking);
      res.send({
        ...booking,
        _id: result.insertedId,
      });
    });

    app.get("/api/bookings", async (req, res) => {
      try {
        const { userEmail } = req.query;
        const query = userEmail ? { userEmail } : {};
        const result = await bookingCollection
          .find(query)
          .sort({ createdAt: -1 })
          .toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: error.message });
      }
    });

    app.patch("/api/bookings/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const { status, transactionId } = req.body;

        const booking = await bookingCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!booking) {
          return res.status(404).send({
            message: "Booking not found",
          });
        }

        await bookingCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              status,
              transactionId,
              paymentDate:
                status === "paid" ? new Date() : null,
              updatedAt: new Date(),
            },
          }
        );

        if (
          status === "paid" && booking.status !== "paid") {
          await ticketCollection.updateOne(
            {
              _id: new ObjectId(booking.ticketId),
              quantity: { $gte: booking.quantity }
            },
            {
              $inc: {
                quantity: -booking.quantity,
              },
            }
          );
        }

        res.send({ success: true });
      } catch (error) {
        res.status(500).send({
          message: error.message,
        });
      }
    });

    app.get("/api/vendor/revenue", async (req, res) => {
      try {
        const { vendorEmail } = req.query;

        if (!vendorEmail) {
          return res.status(400).send({
            message: "vendorEmail required",
          });
        }

        const totalTicketsAdded = await ticketCollection.countDocuments({
          vendorEmail,
        });

        const result = await bookingCollection
          .aggregate([
            {
              $match: {
                status: { $regex: /^paid$/i },
              },
            },

            {
              $addFields: {
                ticketObjectId: {
                  $toObjectId: "$ticketId",
                },
              },
            },

            {
              $lookup: {
                from: "tickets",
                localField: "ticketObjectId",
                foreignField: "_id",
                as: "ticket",
              },
            },

            {
              $unwind: "$ticket",
            },
            {
              $match: {
                "ticket.vendorEmail": vendorEmail,
              },
            },
            {
              $group: {
                _id: null,
                totalTicketsSold: {
                  $sum: "$quantity",
                },
                totalRevenue: {
                  $sum: {
                    $multiply: ["$quantity", "$unitPrice"], // 🔥 BEST FIX
                  },
                },
              },
            },
          ])
          .toArray();

        res.send({
          totalTicketsAdded,
          totalTicketsSold: result[0]?.totalTicketsSold || 0,
          totalRevenue: result[0]?.totalRevenue || 0,
        });
      } catch (error) {
        console.error(error);
        res.status(500).send({
          message: error.message,
        });
      }
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})