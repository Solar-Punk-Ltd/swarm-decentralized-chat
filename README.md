# Swarm Decentralized Chat

## Overview 

A decentralized group chat library that uses [Swarm feeds](https://docs.ethswarm.org/docs/develop/tools-and-features/feeds/) for user list handling, and message sending as well.

Currently work-in-progress, don't use it in production!

## Installation and Usage

x) Install Bee
You need to have access to a Bee node, with a valid stamp. Follow [these instructions](), to install Bee.
If you have access to a Bee node, next step is to add the library to your project

x) Install swarm-cli
`npm install -g @ethersphere/swarm-cli

x) Buy Stamp
To buy stamp for ~1 day, you should run this command:
`swarm-cli stamp buy --depth 22 --amount 480m

x) Add the library to you project
`npm install --save @solarpunkltd/swarm-decentralized-chat
 
x) Set up swarm-decentralized-chat, to receive messages

 



To use SwarmChat in your project, you need to create a SwarmChat instance. To use default settings, you can simply do this like this:
```
chat = new SwarmChat();
```
Bee url will be `http://localhost:1633`.

If you want to use different node, you can do that the following way:
```
chat = new SwarmChat({
    url: "https://myurl.com:1633"
});
```

### Possible settings for `SwarmChat`:
 - `url`: Bee url with port (e.g. "http://myurl.com:1633")  
 - `gateway`: Overlay address of the gateway. If exists, SwarmChat will run in gateway mode  
 - `gsocResourceId`: Non-gateway nodes need to provide this, when in gateway mode. It was created on the gateway.  
 - `prettier`: Enable prettier lib, which adds colorizing capabilities to logs (browsers do not support this)  
 - `usersFeedTimeout` Can adjust UsersFeedCommit write timeout, but higher values might cause SocketHangUp in Bee. This is provided in ms  
 - `removeInactiveInterval` This is how often removeIdleUsers will run, specified in ms
 - `idleTime`: Can adjust idle time, after that, usser is inactive (messages not polled). Default is 10 minutes (10000). Specified in ms.  
 - `userLimit`: Maximum active users. This is stronger than idleTime, either this many users will be polled for new messages, or idleTime. Default value is 20.  
 - `messageCheckInterval`: Start value for messageCheckInterval. If not specified, the default value is 3x the value of `messageFetchMin` (which is 300 ms by default)  
 - `userUpdateInterval`: How often getNewUsers will run (ms)  
 - `maxTimeout`: This is the max timeout for readMessage. Increases performance, but if this is lower than a normal readMessage time, you won't be able to read messages!  
 - `maxParallelIncreaseLimit`: If average request time is below this, max parallel request count of the messageQueue is increased. More messages will be read in parallel.  
 - `maxParallelDecreaseLimit`: If average request time is above this, max parallel request count of the messageQueue is decreased. Less messages will be read in parallel.  
 - `fetchIntervalIncreaseLimit`: If average request time is above this, message fetch interval is increased (lower frequency, ms)  
 - `fetchIntervalDecreaseLimit`: If average request time is below this, message fetch interval is decreased (higher frequency, ms)  
 - `messageFetchMin`: The `messageCheckInterval` is dynamically adjusted, this is the lowest value possible (ms)  
 - `messageFetchMax`: The `messageCheckInterval` is dynamically adjusted, this is the highest value possible (ms)  
 - `fStep`: When fetch interval is changed, it is changed by this value
 - `logLevel`: Log level can be one of the following values:  `fatal` | `error` | `warn` | `info` | `debug` | `trace` | `silent`


## Contributing

..