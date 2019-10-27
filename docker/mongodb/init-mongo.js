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

let msg_1_id = ObjectId()
let msg_2_id = ObjectId()

db.messages.insertMany([
    { _id: msg_1_id, author: 'Noob', body: 'Hello' },
    { _id: msg_2_id, author: 'Matt', body: 'Hey' }
])

db.channels.insertMany([
    { _id: ObjectId(), name: 'General', message_ids: [msg_1_id] },
    { _id: ObjectId(), name: 'Fatshaming', message_ids: [msg_2_id] }
])