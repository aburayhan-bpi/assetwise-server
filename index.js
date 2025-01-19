const express = require('express')
require('dotenv').config()
const app = express()
const cors = require('cors')
const morgan = require('morgan')
const jwt = require('jsonwebtoken')

const port = process.env.PORT | 5000
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)



// middleware
app.use(express.json())
app.use(
    cors({
        origin: [
            "http://localhost:5173",
            "http://localhost:5000",
        ],
        credentials: true,
    })
);
app.use(morgan('dev'))


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.pw1gp.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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
        // await client.connect();

        // db collections
        const usersCollection = client.db('assetwiseDB').collection('users')
        const paymentsCollection = client.db('assetwiseDB').collection('payments')
        const assetsCollection = client.db('assetwiseDB').collection('assets')





        // jwt related apis
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            // console.log(user)
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
            // console.log(token)
            res.send({ token })
        });

        // middlewaress
        const verifyToken = (req, res, next) => {
            console.log('inside verifyToken middleware', req.headers.authorization)

            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'unauthorized access' })
            }
            const token = req.headers.authorization.split(' ')[1];

            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded) => {
                if (error) {
                    return res.status(401).send({ message: 'unauthorized access' })
                }
                req.decoded = decoded;
                next();
            })
        };

        // use verify admin after verify token
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await userCollection.findOne(query)
            const isAdmin = user?.role === 'admin'
            if (!isAdmin) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            next();
        };


        // save employee to db
        app.post('/employee', async (req, res) => {
            const employeeInfo = req.body;
            const query = { email: employeeInfo?.email }

            const ifExists = await usersCollection.findOne(query);
            if (ifExists) {
                // return res.status(403).send({ message: 'Employee already exists!', insertedId: null })
                return;
            }
            const result = await usersCollection.insertOne(employeeInfo);
            res.send(result)
        });

        // save hr to db
        app.post('/hr', async (req, res) => {
            const hrInfo = req.body;
            const query = { email: hrInfo?.email };
            const ifExists = await usersCollection.findOne(query);
            if (ifExists) {
                return res.status(403).send({ message: 'Already exists!', insertedId: null })
            }
            const result = await usersCollection.insertOne(hrInfo);
            res.send(result);
        });

        // get all users
        app.get('/users', verifyToken, async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result);
        });

        // update hr user info after successfully payment
        app.patch('/update-hr/:id', async (req, res) => {
            const id = req.params.id;
            const { limit } = req.body;
            const query = { _id: new ObjectId(id) };
            const result = await usersCollection.updateOne(
                query,
                { $set: { limit: limit } }
            )
            res.send(result)
        });

        // add asset api endpoint
        app.post('/assets', verifyToken, async (req, res) => {
            const assetData = req.body;
            try {
                if (assetData) {
                    const result = await assetsCollection.insertOne(assetData);
                    res.send(result);
                }
            } catch (err) {
                console.log('Failed during asset add!')
            }
        });

        // get / fetch all asset
        app.get('/assets', verifyToken, async (req, res) => {
            const searchQuery = req.query.search;

            let cursor;
            try {
                if (searchQuery) {
                    cursor = assetsCollection
                        .find({ productName: { $regex: searchQuery, $options: 'i' } })
                } else {
                    cursor = assetsCollection.find();
                }


                const result = await cursor.toArray();
                res.send(result)
            } catch (err) {
                console.log(err)
                res.status(500).send({ error: 'Failed to fetch assetssss' })
            }

        });

        // delete a spcecific asset by it's id
        app.delete('/assets/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };

            try {
                if (id) {
                    const result = await assetsCollection.deleteOne(query);
                    res.send(result);
                }
            } catch (err) {
                console.log('failed to delete asset')
                return res.send({ message: 'failed to delete asset.' })
            }
        });





        // // save employee to db
        // app.post('/employee', async (req, res) => {
        //     const employeeInfo = req.body;
        //     const query = { email: employeeInfo?.email }

        //     const ifExists = await employeeCollection.findOne(query);
        //     if (ifExists) {
        //         // return res.status(403).send({ message: 'Employee already exists!', insertedId: null })
        //         return;
        //     }
        //     const result = await employeeCollection.insertOne(employeeInfo);
        //     res.send(result)
        // });

        // // save hr to db
        // app.post('/hr', async (req, res) => {
        //     const hrInfo = req.body;
        //     const query = { email: hrInfo?.email };
        //     const ifExists = await hrCollection.findOne(query);
        //     if (ifExists) {
        //         return res.status(403).send({ message: 'Already exists!', insertedId: null })
        //     }
        //     const result = await hrCollection.insertOne(hrInfo);
        //     res.send(result);
        // });















        // payment intent
        app.post('/create-payment-intent', async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100);
            console.log(amount, 'amount inside the intent');

            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });
            res.send({
                clientSecret: paymentIntent.client_secret
            })
        });

        app.post('/payment', async (req, res) => {
            const paymentData = req.body;

            try {

                const query = {
                    email: paymentData.email,
                    limit: paymentData?.limit,
                };

                // Check if the payment data already exists
                const existingPayment = await paymentsCollection.findOne(query);

                if (existingPayment) {
                    return res.status(400).send({ message: "Payment data already exists!" });
                }

                // Insert the new payment data
                const result = await paymentsCollection.insertOne(paymentData);
                res.send(result);
            } catch (error) {
                console.error("Error saving payment data:", error);
                res.status(500).send({ message: "Internal server error" });
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


app.get('/', (req, res) => {
    res.send('Hello from AssetWise Server..')
})

app.listen(port, () => {
    console.log(`AssetWise is running on port ${port}`)
})
