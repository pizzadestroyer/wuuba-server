const { ApolloServer, gql, PubSub } = require('apollo-server');
const uuid = require('uuid/v4');

const pubsub = new PubSub();

const typeDefs = gql`
  type Message {
    id: String
    author: String
    body: String
  }

  type Channel {
    id: String
    name: String
  }

  type Query {
    messages: [Message]
    channels: [Channel]
    messagesInChannel(channelId: String!): [Message]
  }

  type Mutation {
    postMessage(author: String!, body: String!, channelId: String!): Message
  }

  type Subscription {
    messagePosted: Message
  }
`;

const chn_1_id = uuid();
const chn_2_id = uuid();
const msg_1_id = uuid();
const msg_2_id = uuid();

const channels = [
  {
    id: chn_1_id,
    name: 'Fuck bois'
  },
  {
    id: chn_2_id,
    name: 'Manhoes'
  }
]

const messagesInChannel = [
  { 
    channelId: chn_1_id,
    messageIds: [msg_1_id]
  },
  { 
    channelId: chn_2_id,
    messageIds: [msg_2_id]
  }
]

const messages = [
  {
    id: msg_1_id,
    author: 'Noob',
    body: 'you are noob'
  },
  {
    id: msg_2_id,
    author: 'Pro',
    body: 'l2p'
  }
];

const MESSAGE_POSTED = 'MESSAGE_POSTED';

const resolvers = {
  Query: {
    messages: () => messages,
    channels: () => channels,
    messagesInChannel(obj, args, context, info) {
      let channel = messagesInChannel.find(x => x.channelId === args.channelId)
      let result = messages.filter(x => channel.messageIds.includes(x.id))
      return result
    } 
  },
  Mutation: {
    postMessage: (parent, args) => {
      let message = { id: uuid(), author: args.author, body: args.body }
      pubsub.publish(MESSAGE_POSTED, { messagePosted: message });
      let channel = messagesInChannel.find(x => x.channelId === args.channelId)
      channel.messageIds.push(message.id)
      messages.push(message);
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