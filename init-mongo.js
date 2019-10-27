db.createUser({
    user: "wuuba",
    pwd: "mongodbpassu123",
    roles: [
        {
            role: "readWrite",
            db: "wuuba"
        }
    ]
})

const msg_1_id = ObjectId()
const msg_2_id = ObjectId()
const chnl_1_id = ObjectId()
const chnl_2_id = ObjectId()

db.messages.insertMany([
    { _id: msg_1_id, channel_id: chnl_1_id, author: 'Noob', body: 'Hello' },
    { _id: msg_2_id, channel_id: chnl_2_id, author: 'Matt', body: 'Hey' }
])

db.channels.insertMany([
    { _id: chnl_1_id, name: 'General' },
    { _id: chnl_2_id, name: 'Fatshaming' }
])