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


    // GET user
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

    // UPDATE user
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
      const { id } = req.params;
      const { role, isFraud } = req.body;

      const updateDoc = {};

      // যদি role পাঠায়
      if (role) {
        updateDoc.role = role;
      }

      // যদি fraud mark করে
      if (typeof isFraud === "boolean") {
        updateDoc.isFraud = isFraud;
      }

      const result = await userCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updateDoc }
      );

      // ❗ Fraud হলে tickets hide হবে
      if (isFraud === true) {
        await ticketCollection.updateMany(
          { vendorId: id },
          { $set: { hidden: true } }
        );
      }

      res.send(result);
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

        // ✅ important safety filters
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

        // ❌ only approved ticket advertise করা যাবে
        if (ticket.status !== "approved") {
          return res.status(400).send({
            message: "Only approved tickets can be advertised",
          });
        }

        // ❌ max 6 active ads
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
            status: "approved"
          })
          .sort({ createdAt: -1 })
          .limit(8)
          .toArray();

        res.send(tickets);
      } catch (error) {
        res.status(500).send({ message: error.message });
      }
    });


    // Get Single Ticket
    app.get("/api/tickets/:id", async (req, res) => {
      const id = req.params.id;

      const result = await ticketCollection.findOne({
        _id: new ObjectId(id),
      });

      res.send(result);
    });

    // Add Ticket
    app.post("/api/tickets", async (req, res) => {
      const ticket = req.body;

      const result = await ticketCollection.insertOne({
        ...ticket,
        status: "pending",
        createdAt: new Date(),
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

    // Delete Ticket
    app.delete("/api/tickets/:id", async (req, res) => {
      const id = req.params.id;

      const result = await ticketCollection.deleteOne({
        _id: new ObjectId(id),
      });

      res.send(result);
    });


    // CREATE BOOKING
    app.post("/api/bookings", async (req, res) => {
      try {
        const { unitPrice, quantity, ticketTitle, ticketId, userEmail } = req.body;

        const price = Number(unitPrice);
        const qty = Number(quantity);

        const booking = {
          ticketId,
          ticketTitle,
          userEmail,
          quantity: qty,
          unitPrice: price,
          totalPrice: price * qty,
          status: "pending",
          createdAt: new Date(),
        };

        const result = await bookingCollection.insertOne(booking);

        res.send({
          success: true,
          insertedId: result.insertedId,
          booking,
        });
      } catch (error) {
        res.status(500).send({ message: error.message });
      }
    });

    // GET BOOKINGS
    app.get("/api/bookings", async (req, res) => {
      const result = await bookingCollection.find().toArray();
      // console.log("BOOKINGS FROM DB:", result);
      res.send(result);
    });

    // UPDATE STATUS (ACCEPT / REJECT)
    app.patch("/api/bookings/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const { status } = req.body;

        const booking = await bookingCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!booking) {
          return res.status(404).send({ message: "Booking not found" });
        }

        // update booking status
        await bookingCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status } }
        );

        // ONLY reduce quantity when approved
        if (status === "approved") {
          await ticketCollection.updateOne(
            { _id: new ObjectId(booking.ticketId) },
            {
              $inc: {
                quantity: -Number(booking.quantity),
              },
            }
          );
        }

        res.send({
          success: true,
          message: `Booking ${status}`,
        });
      } catch (error) {
        res.status(500).send({ message: error.message });
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