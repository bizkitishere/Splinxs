/**
 * tourist.connection.js
 * contains functions related with the connection on the tourist side
 * used by tourists
 */

//variables
showLogs = true;

//guide channel
var channelCounter = 0;
var channels = ["myGuideChannel1"];
var channel = channels[channelCounter];

var connection = new RTCMultiConnection();

username = "tourist";

/**
 * sets the channel, media and mandatory constraints
 */
setSessionConstraints();


function setSessionConstraints() {
    //connection = new RTCMultiConnection();
    //connection.socketURL = '/';
    
    connection.channel = channel;
    
    connection.socketCustomEvent = connection.channel;
    
    //connection.socketURL = '/';

    //TODO only add media that is supported by the browser
    connection.session = {
        data: true
                //, audio: true
                //, video: true
    };

    connection.sdpConstraints.mandatory = {
        OfferToReceiveAudio: false,
        OfferToReceiveVideo: false
    };
}

connection.onopen = function (event) {
    if (showLogs) console.log('tourist: connection opened');

    if (connection.alreadyOpened)
        return;
    connection.alreadyOpened = true;

};

connection.onmessage = function (message) {
    if (showLogs) console.log('tourist: sctp message arrived');
    if (!message.data) {
        if (showLogs) console.log('tourist: empty sctp message');
        return;
    }
    onMessage(message.data);
};

/**
 * fires when the signalling websocket was connected successfully
 * this socket will be used as a fall back if SCTP is not available
 * @param {Websocket} socket Websocket used for signalling and sending other messages
 */
connection.connectSocket(function (socket) {
    if (showLogs) console.log('tourist: websocket connected');
    websocket = socket;
    
    // listen custom messages from server
    socket.on(connection.socketCustomEvent, function (message) {
        if (showLogs) console.log('tourist: websocket message arrived');
        if (!message.customMessage) {
            if (showLogs) console.log('tourist: empty websocket message');
            return;
        }
        //message that peer only supports websockets => I will use only websockets too
        if(message.customMessage.connection){
            if (showLogs) console.log('tourist: peer only supports websockets, will do the same');
            connectionState.DataChannel = connectionStates.DataChannel.Websocket;
            return;
        }
        //guide declines connection
        if(message.customMessage.guideDeclinesRequest){
            if (showLogs) console.log('tourist: guide declined request :(');
            changeToNextChannel();
            return;
        }
        //guide accepts connection
        if(message.customMessage.guideAcceptsRequest) {
            if (showLogs) console.log('tourist: guide accepted request :)');
            clearTimeout(conEstabTimeout);
            conEstabTimeout = null;
            //send message to peer if I do not support sctp
            if (supportsOnlyWebsocket()) {
                sendUseWebsocketConnection();
            }
            sendUsername(username);
            return;
        }
        
        onMessage(message.customMessage);
    });
});
/**
 * checks what kind of message arrived acts accordingly
 * @param {String} message message sent by peer
 */
function onMessage(message) {
    if (message.typing) {
        if (showLogs) console.log('tourist: peer typing');
        peerIsTyping(peername);
        return;
    }
    if (message.stoppedTyping) {
        if (showLogs) console.log('tourist: peer stopped typing');
        peerStoppedTyping();
        return;
    }
    if (message.username) {
        if (showLogs) console.log('tourist: peername: ' + message.username);

        peername = message.username;

        establishConnectionWithGuide();
        return;
    }
    messageArrived(message);
}
/**
 * sends the guide a request for communication
 */
function initConnectionWithGuide() {
    if(showLogs) console.log('tourist: initiating connection with guide in channel: ' + channel);
    
    showLoadBox();
    
    //request connection with current channel (guide)
    sendTouristRequestsGuide();
    //will continue in message.customMessage.guideTouristRequestReply or timeout
    conEstabTimeout = setTimeout(function () {
        if(showLogs) console.log('tourist: connect to guide timeout');
        changeToNextChannel();
    }, conEstabTimer);
}

function establishConnectionWithGuide() {
    if (showLogs) console.log('establishing connection with guide');
    //TODO check if also possible in websocket case
    connection.join(channel);
    
    hideLoadBox();
    
    /*
    if (!supportsOnlyWebsocket()) {
        if (showLogs) console.log('tourist: joining channel: ' + channel);
        connection.join(channel);
    }else{
        if (showLogs) console.log('tourist: joining using websocket');
    }
    */
    showGUI();
    showTouristUI();
}
/**
 * if the guide refused the connection or a timeout occured, try the next channel (guide)
 */
function changeToNextChannel(){
    if(showLogs) console.log('tourist: changing to next channel');
    clearTimeout(conEstabTimeout);
    conEstabTimeout = null;
    //TODO check if necessary
    //connection.close();
    //connection.disconnect();
    channelCounter++;
    if(channelCounter == channels.length){
        if(showLogs) console.log('tourist: tried all channels without success :\'(');
        hideLoadBox();
        //TODO do something...
        return;
    }
    channel = channels[channelCounter];
    setSessionConstraints(); //TODO check if works
    initConnectionWithGuide();
}

