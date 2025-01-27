const express = require('express')
require('dotenv').config()
const app = express()
const cors = require('cors')
const morgan = require('morgan')
const jwt = require('jsonwebtoken')

const port = process.env.PORT | 5000
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const moment = require('moment');


// middleware
app.use(express.json())
app.use(
    cors({
        origin: [
            "http://localhost:5173",
            "http://localhost:5000",
            "https://assetwise-server.vercel.app",
            "https://assetwise-b85cb.web.app",
            "https://assetwise-b10a12.netlify.app"
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
        const requestedAssetCollection = client.db('assetwiseDB').collection('requestedAssets')





        // jwt related apis
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            // console.log(user)
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '4h' });
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
                return res.send(ifExists);
            }
            const result = await usersCollection.insertOne(employeeInfo);
            res.send(result)
        });

        // update user name to db
        app.patch('/update-name/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const newName = req.query.newName;
            // console.log('user id:', id)
            // console.log('user new name:', newName)
            const query = { _id: new ObjectId(id) };
            try {
                if (id && newName) {
                    const result = await usersCollection.updateOne(
                        query,
                        { $set: { name: newName } }
                    )
                    if (result.acknowledged && result.modifiedCount > 0) {
                        // console.log(result)
                        res.send(result);
                    }
                } else {
                    res.status(400).send({ message: 'Failed to update name.' })
                }
            } catch (err) {
                // console.log(err);
                res.status(500).send({ message: 'Something went wrong while updating user name.' });
            }
        });




        // get current user
        app.get('/current-user', async (req, res) => {
            const email = req.query.email;
            console.log('current user email: ', email)
            const query = { email: email };
            const result = await usersCollection.findOne(query);
            console.log(result)
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
            // console.log('New package details', limit, package)
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
                // console.log('Failed during asset add!')
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
                // console.log("Error fetching single asset data", err)
                res.status(404).send({ message: 'Asset not fount.' })
            }
        });


        // get / fetch all asset
        // app.get('/assets', verifyToken, async (req, res) => {
        //     const searchQuery = req.query?.search;
        //     const filterOption = req.query?.filterOption;
        //     const sortOption = req.query?.sortOption;
        //     const email = req.query?.email; // Get the email from the query

        //     let cursor;

        //     try {
        //         const query = email ? { email } : {}; // Filter by email if provided
        //         if (searchQuery) {
        //             query.productName = { $regex: searchQuery, $options: 'i' }; // Add search condition
        //         }

        //         if (filterOption === 'available') {
        //             query.productQuantity = { $gt: 0 }; // Products with quantity greater than 0
        //         } else if (filterOption === 'stock-out') {
        //             query.productQuantity = 0; // Products with quantity greater than 0
        //         } else if (filterOption) {
        //             query.productType = filterOption; // Add filter condition
        //         }


        //         // if (available === 'true') {
        //         // } else if (stockout === 'true') {
        //         //     query.productQuantity = 0; // Products with quantity equal to 0
        //         // }

        //         cursor = assetsCollection.find(query);

        //         if (sortOption === 'asc') {
        //             cursor = cursor.sort({ productQuantity: 1 });
        //         } else if (sortOption === 'desc') {
        //             cursor = cursor.sort({ productQuantity: -1 });
        //         }


        //         const result = await cursor.toArray();
        //         res.send(result);
        //     } catch (err) {
        //         // console.error("Error fetching assets:", err);
        //         res.status(500).send({ error: "Failed to fetch assets" });
        //     }
        // });
        app.get('/assets', verifyToken, async (req, res) => {
            const { search, filterOption, sortOption, email } = req.query;

            try {
                const query = email ? { email } : {}; // Filter by email
                if (search) {
                    query.productName = { $regex: search, $options: 'i' }; // Search condition
                }
                if (filterOption === 'available') {
                    query.productQuantity = { $gt: 0 }; // Available items
                } else if (filterOption === 'stock-out') {
                    query.productQuantity = 0; // Stock-out items
                } else if (filterOption) {
                    query.productType = filterOption; // Filter by type
                }

                let cursor = assetsCollection.find(query);

                if (sortOption === 'asc') {
                    cursor = cursor.sort({ productQuantity: 1 }); // Sort ascending
                } else if (sortOption === 'desc') {
                    cursor = cursor.sort({ productQuantity: -1 }); // Sort descending
                }

                const result = await cursor.toArray();
                res.send(result);
            } catch (err) {
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
                // console.log('Failed to update', err)
                res.status(400).send({ message: 'Failed to update for Bad Request' })
            }
            // console.log(newAssetData)
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
                // console.log('failed to delete asset')
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


        // add or save employee to db
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

        // get all team members info according to logged in HR
        app.get('/team/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            const query = { email: email };

            try {
                if (email) {
                    const result = await teamCollection.findOne(query);
                    // console.log(result)

                    // find these user who are employe
                    const employees = await usersCollection.find({ role: 'employee' }).toArray()
                    // console.log(employees)
                    // find out affiliatedWith the current hr email and return to client side
                    const team = employees.filter((singleEmp) => singleEmp?.affiliatedWith === email)
                    // console.log('team', team)
                    res.send(team);
                }
            } catch (err) {
                // console.log('Team not fount according email')
                res.status(404).send({ message: 'Team not found with current hr email' });
            }
        });

        // get company info or logo for affiliatedWith employe
        app.get('/company-info', async (req, res) => {
            const email = req.query.email;
            // console.log(email)

            try {
                const leader = await usersCollection.findOne({ email: email })
                const teamPhoto = leader?.companyPhoto
                // console.log(teamPhoto)
                res.send(teamPhoto)
            } catch (err) {
                // console.log("error while fetching company info", err)
            }

        })

        // company details
        app.get('/company-details', verifyToken, async (req, res) => {
            const email = req.query.email;
            const query = { email: email }
            const result = await usersCollection.findOne(query);
            res.send(result);
        });

        // delete a team member
        app.delete('/delete-team-member/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const email = req.query.email;
            const filter = { _id: new ObjectId(id) };

            try {
                // Update the user document (remove affiliatedWith)
                const updatedEmployee = await usersCollection.updateOne(
                    filter,
                    { $unset: { 'affiliatedWith': 1 } }
                );

                if (email) {
                    const memberIdToRemove = new ObjectId(id);
                    const updatedTeamMember = await teamCollection.updateOne(
                        { email: email },
                        { $pull: { members: memberIdToRemove } }
                    );
                    // console.log('emp user', updatedTeamMember);
                }
                // console.log('team user', updatedEmployee);

                // Check for successful updates (at least one collection modified)
                if (updatedEmployee.modifiedCount === 1 || (email && updatedTeamMember.modifiedCount === 1)) {
                    res.status(200).json({ message: 'Team member deleted successfully' });
                } else {
                    res.status(400).json({ message: 'Failed to delete team member' });
                }
            } catch (error) {
                console.error('Error deleting team member:', error);
                res.status(500).json({ message: 'Server error occurred' });
            }
        });

        // fetch my team members for an employee who have affiliaed with anycompany
        app.get('/my-team', verifyToken, async (req, res) => {
            // const employeeId = req.params.id;
            const teamEmail = req.query.teamEmail;
            if (!teamEmail) {
                res.status(404).send({ message: 'Team Email are required' })
            }
            try {
                const myTeam = await usersCollection.find({ affiliatedWith: teamEmail }).toArray();

                if (!myTeam) {
                    return res.status(404).send({ message: "No team found!" });
                }
                // console.log('my team', myTeam)
                res.send(myTeam);

            } catch (err) {
                // console.error("Error fetching team:", err);
                res.status(500).send({ message: "Failed to fetch team information" });
            }
        });

        // get my hr assets
        app.get('/my-hr-assets', verifyToken, async (req, res) => {
            // const searchQuery = req.query?.search;
            // const filterOption = req.query?.filterOption;
            // const email = req.query.email; // Get the email from the query
            const { email, searchQuery, filterOption } = req.query;


            let cursor;
            try {
                const query = email ? { email } : {}; // Filter by email if provided
                if (searchQuery) {
                    query.productName = { $regex: searchQuery, $options: 'i' }; // Add search condition
                }

                if (filterOption === 'available') {
                    query.productQuantity = { $gt: 0 }; // Products with quantity greater than 0
                } else if (filterOption === 'stock-out') {
                    query.productQuantity = 0; // Products with quantity greater than 0
                } else if (filterOption) {
                    query.productType = filterOption; // Add filter condition
                }

                cursor = assetsCollection.find(query);

                const result = await cursor.toArray();
                res.send(result);
            } catch (err) {
                // console.error("Error fetching assets:", err);
                res.status(500).send({ error: "Failed to fetch assets" });
            }
        });

        // request for an asset - (For AffiliatedWith Employees)
        app.post('/request-asset/:email', verifyToken, async (req, res) => {
            const requestedEmployee = req.params.email;
            const requestedAssetData = req.body;
            const query = { _id: new ObjectId(requestedAssetData?.assetId) };

            try {
                if (requestedEmployee && requestedAssetData) {
                    const result = await requestedAssetCollection.insertOne(requestedAssetData);
                    // console.log(result)
                    if (result.acknowledged) {
                        await assetsCollection.updateOne(
                            query,
                            { $inc: { productQuantity: -1 } }
                        )
                    }
                    res.send(result);
                }
            } catch (err) {
                // console.log(err)
                res.status(400).send({ message: 'Failed to add requested asset!' })
            }
        });


        // fetch / get my requested assets data ---> affiliatedWith Employee
        app.get('/my-req-assets', verifyToken, async (req, res) => {
            // const searchQuery = req.query?.search;
            // const filterOption = req.query?.filterOption;
            // const email = req.query.email; // Get the email from the query
            const { email, searchQuery, filterOption } = req.query;
            console.log(req.query)
            let cursor;
            try {
                const query = email ? { requesterEmail: email } : {}; // Filter by email if provided
                if (searchQuery) {
                    query.productName = { $regex: searchQuery, $options: 'i' }; // Add search condition
                }

                if (filterOption === 'pending') {
                    query.status = 'pending';
                } else if (filterOption === 'approved') {
                    query.status = 'approved';
                } else if (filterOption) {
                    query.productType = filterOption;
                }

                cursor = requestedAssetCollection.find(query);

                const result = await cursor.toArray();
                res.send(result);
            } catch (err) {
                console.error("Error fetching assets:", err);
                res.status(500).send({ error: "Failed to fetch assets" });
            }
        });

        // My pending requests asset data
        app.get('/pending-requests', async (req, res) => {
            const empEmail = req.query.email;
            const query = { requesterEmail: empEmail, status: 'pending' };
            try {
                if (empEmail) {
                    const result = await requestedAssetCollection.find(query).toArray()
                    // console.log(result);
                    res.send(result);
                } else {
                    res.status(400).send({ message: 'Faile to fetch my pending request data or email invalid.' })
                }
            } catch (err) {
                // console.log(err)
                res.status(500).send({ message: 'Something went wrong while fetching my pending requests asset data.' })
            }
        });


        // My monthly requests asset data
        app.get('/monthly-requests', async (req, res) => {
            const empEmail = req.query.email;
            const query = { requesterEmail: empEmail };

            // Get the current month's start date
            const startOfMonth = moment().startOf('month').format('YYYY-MM-DD');

            // Get the current month's end date
            const endOfMonth = moment().endOf('month').format('YYYY-MM-DD');

            try {
                if (empEmail) {
                    const result = await requestedAssetCollection
                        .find({
                            $and: [
                                query, // Match email
                                { requestDate: { $gte: startOfMonth, $lte: endOfMonth } }, // Match current month
                            ],
                        })
                        .sort({ requestDate: -1 }) // Sort by requestDate descending
                        .toArray();

                    // console.log(result);
                    res.send(result);
                } else {
                    res.status(400).send({ message: 'Failed to fetch my monthly request data. Email invalid or missing.' });
                }
            } catch (err) {
                console.error(err);
                res.status(500).send({ message: 'Something went wrong while fetching my monthly request data.' });
            }
        });


        // asset request cancel system api
        app.patch('/cancel-request/:id', verifyToken, async (req, res) => {
            const assetId = req.params.id;
            // console.log(id)
            const reqAssetId = req.query.reqAssetId;
            const statusQuery = { _id: new ObjectId(reqAssetId) }
            const queryForQuantity = { _id: new ObjectId(assetId) };
            const currentDate = moment().format('YYYY-MM-DD');
            try {
                if (assetId) {
                    const result = await requestedAssetCollection.updateOne(
                        statusQuery,
                        {
                            $set: {
                                cancelledDate: currentDate,
                                status: 'cancelled'
                            }
                        }
                    )

                    // increase productQuantity by one
                    const updateQuantity = await assetsCollection.updateOne(
                        queryForQuantity,
                        { $inc: { productQuantity: 1 } }
                    )
                    // console.log('quantity updated: ', updateQuantity)
                    if (result.acknowledged && updateQuantity.acknowledged) {
                        res.send(result)
                    }
                } else {
                    res.status(404).send({ message: 'Failed to cancel or ID is not valid.' })
                }
            } catch (err) {
                // console.log(err);
                res.status(500).send({ message: 'Something went wrong while cancel asset.' });
            }
        });

        // asset request return system api
        app.patch('/return-request/:id', verifyToken, async (req, res) => {
            const assetId = req.params.id;
            // console.log(id)
            const reqAssetId = req.query.reqAssetId;
            const statusQuery = { _id: new ObjectId(reqAssetId) }
            const queryForQuantity = { _id: new ObjectId(assetId) };
            const currentDate = moment().format('YYYY-MM-DD');
            try {
                if (assetId) {
                    const result = await requestedAssetCollection.updateOne(
                        statusQuery,
                        {
                            $set: {
                                returnedDate: currentDate,
                                status: 'returned'
                            }
                        }
                    )

                    // increase productQuantity by one for return
                    const updateQuantity = await assetsCollection.updateOne(
                        queryForQuantity,
                        { $inc: { productQuantity: 1 } }
                    )
                    // console.log('quantity updated: ', updateQuantity)
                    if (result.acknowledged && updateQuantity.acknowledged) {
                        res.send(result)
                    }
                } else {
                    res.status(404).send({ message: 'Failed to return or ID is not valid.' })
                }
            } catch (err) {
                // console.log(err);
                res.status(500).send({ message: 'Something went wrong while return asset.' });
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

        // app.get('/all-requests', verifyToken, async (req, res) => {
        //     const searchQuery = req.query?.search;
        //     const filterOption = req.query?.filterOption;
        //     const email = req.query.email; // Get the email from the query

        //     console.log("Search Query:", searchQuery);
        //     console.log("Filter Option:", filterOption);
        //     console.log("Email:", email);

        //     let cursor;
        //     try {
        //         const query = email ? { requestedEmail: email } : {}; // Filter by email if provided
        //         if (searchQuery) {
        //             query.productName = { $regex: searchQuery, $options: 'i' }; // Add search condition
        //         }

        //         if (filterOption === 'pending') {
        //             query.status = 'pending';
        //         } else if (filterOption === 'approved') {
        //             query.status = 'approved';
        //         } else if (filterOption) {
        //             query.productType = filterOption;
        //         }

        //         cursor = requestedAssetCollection.find(query);

        //         const result = await cursor.toArray();
        //         res.send(result);
        //     } catch (err) {
        //         console.error("Error fetching assets:", err);
        //         res.status(500).send({ error: "Failed to fetch assets" });
        //     }

        //     // const result = await assetsCollection.find({ email: email }).toArray()
        //     // res.send(result)
        // });

        // fetch hr team users all requests
        app.get('/all-requests', verifyToken, async (req, res) => {
            // const hrEmail = req.query.email; // Email of the user requesting the data
            // const searchQuery = req.query.search;
            const { hrEmail, searchQuery } = req.query;
            console.log('all request search query: ', searchQuery)
            // console.log('search text', searchQuery);
            // console.log('searched email', hrEmail);

            // let cursor;
            try {
                const query = hrEmail ? { requesterAffiliatedWith: hrEmail } : {};

                if (searchQuery) {
                    // query.requesterName = { $regex: searchQuery, $options: 'i' };
                    query.$or = [
                        { requesterName: { $regex: searchQuery, $options: 'i' } },
                        { requesterEmail: { $regex: searchQuery, $options: 'i' } }
                    ]
                }
                let cursor = requestedAssetCollection.find(query);

                const result = await cursor.toArray();
                res.send(result);
            } catch (err) {
                // console.log(err);
                res.status(404).send({ message: 'Requested assets not found.' });
            }
        });

        // update state of requested assets data
        app.patch('/update-asset-status/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const status = req.query.status;
            // console.log(id, status)
            const query = { _id: new ObjectId(id) };
            const currentDate = moment().format('YYYY-MM-DD');
            try {
                if (id && status === 'approved') {
                    const result = await requestedAssetCollection.updateOne(
                        query,
                        {
                            $set:
                            {
                                status: status,
                                approvalDate: currentDate
                            }
                        }
                    )
                    res.send(result)
                } else if (id && status === 'rejected') {
                    const result = await requestedAssetCollection.updateOne(
                        query,
                        {
                            $set:
                            {
                                status: status,
                                rejectedDate: currentDate
                            }
                        }
                    )
                    res.send(result)
                } else {
                    res.status(400).send({ message: 'Something went wrong!' })
                }
            } catch (err) {
                // console.log(err);
                res.status(500).send({ message: 'Failed to update asset status.' });
            }
        });

        // fetch all requested asset data
        app.get('/pending-assets', async (req, res) => {
            const empEmail = req.query.email;
            const query = { requesterAffiliatedWith: empEmail, status: 'pending' };
            try {
                if (empEmail) {
                    const result = await requestedAssetCollection
                        .find(query)
                        .limit(5)
                        .toArray()
                    // console.log(result);
                    res.send(result);
                } else {
                    res.status(400).send({ message: 'Faile to fetch my pending request data or email invalid.' })
                }
            } catch (err) {
                // console.log(err)
                res.status(500).send({ message: 'Something went wrong while fetching my pending requests asset data.' })
            }
        });

        // top most requested asset data
        app.get('/top-most-requested', async (req, res) => {
            const hrEmail = req.query.email;
            // console.log(hrEmail)
            if (!hrEmail) {
                return res.status(401).send('Unauthorized: User email is required');
            }

            const topAssets = await requestedAssetCollection.aggregate([
                {
                    $match: {
                        requesterAffiliatedWith: hrEmail, // Match only requests by the authenticated user or their team
                    },
                },
                {
                    $group: {
                        _id: "$assetId", // group by asset ID
                        totalRequests: { $sum: 1 }, // Count the total requests for each asset
                        productName: { $first: "$productName" },
                        productType: { $first: "$productType" },

                    },
                },
                { $sort: { totalRequests: -1 } }, // Sort by most requested
                { $limit: 4 }, // Get top 5 most requested assets
            ]).toArray();

            res.send(topAssets)

        });

        // limited stock assets
        app.get('/limited-stock-assets', async (req, res) => {
            const email = req.query.email;
            const query = { email: email, productQuantity: { $lt: 10 } };
            // console.log('Limited stock my email:', email)

            if (email) {
                const result = await assetsCollection.find(query).toArray()
                // console.log(result)
                res.send(result)

            } else {
                res.status(404).send({ message: 'Email is required or something went wrong.' })
            }
        });

        // top quantity assets
        app.get('/top-quantity-assets', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };

            // console.log('Top quantity assets for email:', email);

            if (email) {
                try {
                    const result = await assetsCollection
                        .find(query)
                        .sort({ productQuantity: -1 })
                        .limit(10)
                        .toArray();
                    // console.log("top quantity assets:", result)
                    res.send(result);
                } catch (error) {
                    // console.error(error);
                    res.status(500).send({ message: 'Error fetching top quantity assets.' });
                }
            } else {
                res.status(404).send({ message: 'Email is required or something went wrong.' });
            }
        });


        // product type state
        app.get('/product-type-state', async (req, res) => {
            const email = req.query.email;
            // console.log('Pi State: ', email)
            const returnQuery = {
                requesterAffiliatedWith: email, productType: 'returnable'
            };
            const nonReturnQuery = {
                requesterAffiliatedWith: email, productType: 'non-returnable'
            };
            if (!email) {
                return res.status(404).send({ message: 'Not found. Email is required' })
            };
            const returnableAssets = await requestedAssetCollection.find(returnQuery).toArray()

            const nonReturnableAssets = await requestedAssetCollection.find(nonReturnQuery).toArray()
            // console.log('returnable items: ', returnableAssets)
            // console.log('non-returnable items: ', nonReturnableAssets)

            // calculate counts
            const returnableCount = returnableAssets.length;
            const nonReturnableCount = nonReturnableAssets.length;

            // total count of how many assets
            const totalCount = returnableCount + nonReturnableCount;

            // calculate percentage
            const returnablePercentage = totalCount ? (returnableCount / totalCount) * 100 : 0
            const nonReturnablePercentage = totalCount ? (nonReturnableCount / totalCount) * 100 : 0

            const percentages = [
                {
                    title: 'returnable',
                    percentage: returnablePercentage.toFixed(2)
                },
                {
                    title: 'non-returnable',
                    percentage: nonReturnablePercentage.toFixed(2)
                }
            ]
            res.send(percentages)
        });


        // fetch rejected asset requests
        app.get('/rejected-requests', async (req, res) => {
            const email = req.query.email;
            const query = { requesterAffiliatedWith: email, status: 'rejected' }
            if (!email) {
                res.status(404).send({ message: 'Not found. Email is required.' })
            }
            const result = await requestedAssetCollection.find(query).toArray()
            res.send(result)
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
            // console.log(amount, 'amount inside the intent');

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
                // console.log('failed to update paymetn info', err)
            }
        })







        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        // console.log("Pinged your deployment. You successfully connected to MongoDB!");
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
