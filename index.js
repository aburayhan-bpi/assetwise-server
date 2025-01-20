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
        const teamCollection = client.db('assetwiseDB').collection('team')





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
        app.patch('/update-hr/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const { limit, package } = req.body;
            console.log('New package details', limit, package)
            const query = { _id: new ObjectId(id) };
            const result = await usersCollection.updateOne(
                query,
                { $set: { limit: limit, package: package } }
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

        // get / fetch sngle asset data according id
        app.get('/assets/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            try {
                if (id) {
                    const result = await assetsCollection.findOne(query);
                    res.send(result)
                }
            } catch (err) {
                console.log("Error fetching single asset data", err)
                res.status(404).send({ message: 'Asset not fount.' })
            }
        });


        // get / fetch all asset
        app.get('/assets', verifyToken, async (req, res) => {
            const searchQuery = req.query?.search;
            const filterOption = req.query?.filterOption;
            const sortOption = req.query?.sortOption;
            const email = req.query?.email; // Get the email from the query

            console.log("Search Query:", searchQuery);
            console.log("Filter Option:", filterOption);
            console.log("Sort Option:", sortOption);
            console.log("Email:", email);

            let cursor;

            try {
                const query = email ? { email } : {}; // Filter by email if provided
                if (searchQuery) {
                    query.productName = { $regex: searchQuery, $options: 'i' }; // Add search condition
                }
                if (filterOption) {
                    query.productType = filterOption; // Add filter condition
                }

                cursor = assetsCollection.find(query);

                if (sortOption === 'asc') {
                    cursor = cursor.sort({ productQuantity: 1 });
                } else if (sortOption === 'desc') {
                    cursor = cursor.sort({ productQuantity: -1 });
                }

                const result = await cursor.toArray();
                res.send(result);
            } catch (err) {
                console.error("Error fetching assets:", err);
                res.status(500).send({ error: "Failed to fetch assets" });
            }
        });



        // update asset data
        app.patch('/assets/:id', verifyToken, async (req, res) => {
            const newAssetData = req.body;
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const options = { upsert: true };

            if (req.user?.email !== newAssetData.organizerEmail) {
                return res.status(403).send({ message: 'Forbidden access' });
            }
            try {
                if (newAssetData) {
                    const updatedAssetInfo = {
                        $set: {
                            productName: newAssetData?.productName,
                            productType: newAssetData?.productType,
                            productQuantity: newAssetData?.productQuantity,
                            dateAdded: newAssetData?.dateAdded,
                            dateUpdated: newAssetData?.dateUpdated,
                            email: newAssetData?.email,
                            company: newAssetData?.company,
                            role: newAssetData?.role,
                        }
                    }
                    const result = await assetsCollection.updateOne(filter, updatedAssetInfo, options)
                    res.send(result)
                }
            } catch (err) {
                console.log('Failed to update', err)
                res.status(400).send({ message: 'Failed to update for Bad Request' })
            }
            console.log(newAssetData)
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

        // 
        // 
        // 
        // 
        // 
        // 
        // 
        // 
        // 
        // 
        // 
        // 
        // 


        app.post('/add-employee', async (req, res) => {
            const { empId, email } = req.body; // HR email and Employee ID

            try {
                // Check if the HR already has a team
                let userTeam = await teamCollection.findOne({ email });

                if (!userTeam) {
                    // Create a new team for the HR if it doesn't exist
                    userTeam = {
                        email: email,
                        members: [new ObjectId(empId)],
                    };
                    await teamCollection.insertOne(userTeam);

                    // Update the employee's affiliatedWith property in usersCollection
                    await usersCollection.updateOne(
                        { _id: new ObjectId(empId) },
                        { $set: { 'affiliatedWith': email } }
                    );

                    return res.status(200).json({ success: true, message: "New team created, employee added." });
                }

                // If the HR already has a team, check if the employee is already added to the team
                if (userTeam.members.includes(new ObjectId(empId))) {
                    return res.status(400).json({ success: false, message: "Employee already in your team." });
                }

                // Add employee to the existing team
                await teamCollection.updateOne(
                    { email },
                    { $push: { members: new ObjectId(empId) } }
                );

                // Update the employee's affiliatedWith property in usersCollection
                await usersCollection.updateOne(
                    { _id: new ObjectId(empId) },
                    { $set: { 'affiliatedWith': email } }
                );

                return res.status(200).json({ success: true, message: "Employee added to your team." });
            } catch (error) {
                console.error(error);
                return res.status(500).json({ success: false, message: "Server error." });
            }
        });

        app.post('/add-selected-employees', async (req, res) => {
            const { empIds, email } = req.body; // HR email and Employee IDs

            try {
                // Check if the HR already has a team
                let userTeam = await teamCollection.findOne({ email });

                if (!userTeam) {
                    // Create a new team for the HR if it doesn't exist
                    userTeam = {
                        email: email,
                        members: empIds.map(id => new ObjectId(id)),
                    };
                    await teamCollection.insertOne(userTeam);

                    // Update the affiliatedWith property for all selected employees in usersCollection
                    await usersCollection.updateMany(
                        { _id: { $in: empIds.map(id => new ObjectId(id)) } },
                        { $set: { 'affiliatedWith': email } }
                    );

                    return res.status(200).json({ success: true, message: "New team created, employees added." });
                }

                // If the HR already has a team, add selected employees
                const existingMembers = userTeam.members.map(member => member.toString());
                const newMembers = empIds.filter(id => !existingMembers.includes(id));

                if (newMembers.length === 0) {
                    return res.status(400).json({ success: false, message: "All selected employees are already in your team." });
                }

                // Add the new members to the existing team
                await teamCollection.updateOne(
                    { email },
                    { $push: { members: { $each: newMembers.map(id => new ObjectId(id)) } } }
                );

                // Update the affiliatedWith property for the new members in usersCollection
                await usersCollection.updateMany(
                    { _id: { $in: newMembers.map(id => new ObjectId(id)) } },
                    { $set: { 'affiliatedWith': email } }
                );

                return res.status(200).json({ success: true, message: "Selected employees added to your team." });
            } catch (error) {
                console.error(error);
                return res.status(500).json({ success: false, message: "Server error." });
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

        // save payment info to db when account create
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

        // get specific payment info by current user email
        app.get('/payment/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const result = await paymentsCollection.findOne(query);
            res.send(result);
        });

        // update payment info after package update
        app.patch('/update-payment/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const paymentData = req.body;
            const filter = { _id: new ObjectId(id) };
            try {
                const query = {
                    email: paymentData?.email,
                    limit: paymentData?.limit,
                }

                // check if the payment data or package already selected
                const existingPayment = await paymentsCollection.findOne(query);

                if (existingPayment) {
                    return res.status(400).send({ message: 'Payment or Package already exists!' })
                }

                // update payment info

                if (paymentData) {
                    const updatedPaymentInfo = {
                        $set: {
                            email: paymentData?.email,
                            companyName: paymentData?.companyName,
                            name: paymentData?.name,
                            role: paymentData?.role,
                            package: paymentData?.package,
                            transactionId: paymentData?.transactionId,
                            date: paymentData?.date,
                            status: paymentData?.status,
                            limit: paymentData?.limit,
                        }
                    }
                    const result = await paymentsCollection.updateOne(filter, updatedPaymentInfo)
                    res.send(result);
                }





            } catch (err) {
                console.log('failed to update paymetn info', err)
            }
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


app.get('/', (req, res) => {
    res.send('Hello from AssetWise Server..')
})

app.listen(port, () => {
    console.log(`AssetWise is running on port ${port}`)
})
