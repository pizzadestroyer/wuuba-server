const { ApolloServer, gql, PubSub } = require('apollo-server');
const { MongoClient, ObjectId } = require('mongodb')

const MONGO_URL = 'mongodb://wuuba:mongodbpassu123@mongo:27017/wuuba'

const pubsub = new PubSub();
const MESSAGE_POSTED = 'MESSAGE_POSTED';

MongoClient.connect(MONGO_URL, (err, client) => {
  if (err) console.log(err)

  const Channels = client.db('wuuba').collection('channels')
  const Messages = client.db('wuuba').collection('messages')

  const typeDefs = gql`
    type Message {
      _id: String
      channel_id: String
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
    }

    type Mutation {
      postMessage(channel_id: String!, author: String!, body: String!): Message
    }

    type Subscription {
      messagePosted: Message
    }
  `;

  const resolvers = {
    Query: {
      channels: async () => {
        return await Channels.find().toArray()
      },
      messages: async (obj, args) => {
        return await Messages.find({ channel_id: { $eq: ObjectId(args.channel_id) } }).toArray()
      }
    },
    Mutation: {
      postMessage: async (parent, args) => {
        const result = await Messages.insertOne({ channel_id: ObjectId(args.channel_id), author: args.author, body: args.body })
        const message = result.ops[0]
        pubsub.publish(MESSAGE_POSTED, { messagePosted: message });
        return message;
      }
    },
    Subscription: {
      messagePosted: {
        subscribe: () => pubsub.asyncIterator([MESSAGE_POSTED]),
      },
    }
  }

  const server = new ApolloServer({ 
    typeDefs, 
    resolvers,
    subscriptions: {
      onConnect: (connectionParams, webSocket) => {
        return { user: 'me' };
      }, 
    }
  });

  server.listen().then(({ url, subscriptionsUrl }) => {
    console.log(`Server ready at ${url}`);
    console.log(`Subscriptions ready at ${subscriptionsUrl}`);
  });
})