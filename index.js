const express = require('express');
const cors = require('cors');
const app = express()
require('dotenv').config()
const port = 5000

app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion } = require('mongodb');

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


    app.get('/api/tickets', async(req, res) =>{
        const query = {};
        if(req.query.vendorEmail){
            query.vendorEmail = req.query.vendorEmail;
        }
        if(req.query.status){
            query.status = req.query.status;
        }
        const cursor = ticketCollection.find(query);
        const result = await cursor.toArray();
        res.send(result);
    })

    app.post('/api/tickets', async(req, res) =>{
        const ticket = req.body;
        const result = await ticketCollection.insertOne(ticket);
        res.send(result);
    })








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