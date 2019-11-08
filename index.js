const { ApolloServer, gql, PubSub } = require('apollo-server');
const { MongoClient, ObjectId } = require('mongodb')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const MONGO_URL = 'mongodb://wuuba:mongodbpassu123@mongo:27017/wuuba'
const APP_SECRET = 'salainenagentti123'

const pubsub = new PubSub();
const MESSAGE_POSTED = 'MESSAGE_POSTED'
const CHANNEL_CREATED = 'CHANNEL_CREATED'
const REPLY_POSTED = 'REPLY_POSTED'

MongoClient.connect(MONGO_URL, (err, client) => {
  if (err) console.log(err)

  const Channels = client.db('wuuba').collection('channels')
  const Messages = client.db('wuuba').collection('messages')
  const Replies = client.db('wuuba').collection('replies')
  const Users = client.db('wuuba').collection('users')

  const getUserId = async (request) => {
    const Authorization = request.get('Authorization')
    if (Authorization) {
      const token = Authorization.replace('Bearer ', '')
      const { userId } = jwt.verify(token, APP_SECRET)
      const user = await Users.findOne({_id: { $eq: ObjectId(userId) }})
      if (!user) throw new Error('Not authenticated')
      return user
    }
  }

  const getWsUserId = async (token) => {
    const { userId } = jwt.verify(token, APP_SECRET)
    if (!userId) throw new Error('Not authenticated')
    const user = await Users.findOne({_id: { $eq: ObjectId(userId) }})
    if (!user) throw new Error('Not authenticated')
    return user
  }

  const typeDefs = gql`
    type AuthToken {
      token: String
      user: User
    }

    type User {
      _id: String!
      username: String! 
    }

    type Message {
      _id: String
      channel_id: String
      author: String
      body: String
      replies: [Reply]
    }

    type Reply {
      _id: String
      message_id: String
      author: String
      body: String
    }

    type Channel {
      _id: String
      name: String
    }

    type Query {
      channels: [Channel]
      messages(channel_id: String!): [Message]
      thread(message_id: String!): Message
    }

    type Mutation {
      signup(username: String!, password: String!): AuthToken
      login(username: String!, password: String!): AuthToken
      postMessage(channel_id: String!, body: String!): Message
      postReply(message_id: String!, body: String!): Reply
      createChannel(name: String!): Channel
    }

    type Subscription {
      messagePosted: Message
      replyPosted: Reply
      channelCreated: Channel
    }
  `;

  const resolvers = {
    Query: {
      channels: async (parent, args, context, info) => {
        return await Channels.find().toArray()
      },
      messages: async (parent, args, context, info) => {
        let messages = await Messages.find({ channel_id: { $eq: ObjectId(args.channel_id) } }).toArray()
        let promises = []
        messages.forEach(message => {
          promises.push(Replies.find({ message_id: { $eq: ObjectId(message._id) } }).toArray())
        })
        return Promise.all(promises).then((data) => {
          for(let i = 0; i < data.length; i++) {
            messages[i].replies = data[i]
          }
          return messages
        })
      },
      thread: async (parent, args, context, info) => {
        const message = await Messages.findOne({_id: { $eq: ObjectId(args.message_id)}})
        message.replies = await Replies.find({ message_id: { $eq: ObjectId(args.message_id) } }).toArray()
        return message
      }
    },
    Mutation: {
      signup: async (parent, args, context, info) => {
        const password = await bcrypt.hash(args.password, 10)
        const result = await Users.insertOne({...args, password})
        const user = result.ops[0]
        const token = jwt.sign({ userId: user._id }, APP_SECRET)
        return {
          token,
          user
        }
      },
      login: async (parent, args, context, info) => {
        const user = await Users.findOne({ username: args.username })
        if (!user) throw new Error('User not found')
        const valid = await bcrypt.compare(args.password, user.password)
        if (!valid) throw new Error('Invalid password')
        const token = jwt.sign({ userId: user._id }, APP_SECRET)  
        return {
          token,
          user
        }
      },
      postMessage: async (parent, args, context, info) => {
        const result = await Messages.insertOne({ 
          channel_id: ObjectId(args.channel_id), 
          author: context.username, 
          body: args.body,
          replies: []
        })
        const message = result.ops[0]
        pubsub.publish(MESSAGE_POSTED, { messagePosted: message });
        return message;
      },
      postReply: async (parent, args, context, info) => {
        const result = await Replies.insertOne({ 
          message_id: ObjectId(args.message_id), 
          author: context.username, 
          body: args.body
        })
        const reply = result.ops[0]
        pubsub.publish(REPLY_POSTED, { replyPosted: reply });
        return reply
      },
      createChannel: async (parent, args, context, info) => {
        const result = await Channels.insertOne({ name: args.name })
        const channel = result.ops[0]
        pubsub.publish(CHANNEL_CREATED, { channelCreated: channel });
        return channel;
      }
    },
    Subscription: {
      messagePosted: {
        subscribe: () => pubsub.asyncIterator([MESSAGE_POSTED]),
      },
      replyPosted: {
        subscribe: () => pubsub.asyncIterator([REPLY_POSTED])
      },
      channelCreated: {
        subscribe: () => pubsub.asyncIterator([CHANNEL_CREATED])
      }
    }
  }
  
  const server = new ApolloServer({ 
    typeDefs,
    context: ({req}) => {
      if (!req && (req.body.operationName === 'SignUp' || req.body.operationName === 'Login')) return ""
        return getUserId(req)
    },
    resolvers,
    subscriptions: {
      onConnect: async (connectionParams, webSocket) => {
        const token = connectionParams.authToken
        const user = await getWsUserId(token)
        return { 
          token,
          user
        }
      }, 
    }
  });

  server.listen().then(({ url, subscriptionsUrl }) => {
    console.log(`Server ready at ${url}`);
    console.log(`Subscriptions ready at ${subscriptionsUrl}`);
  });
})