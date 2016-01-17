try {
    var Discord = require("discord.js");
} catch (e) {
    console.log("Please run npm install and ensure it passes with no errors!");
    process.exit();
}

// Get the email and password
var AuthDetails = require("./auth.json");
var bot = new Discord.Client();

//custom commands made in the chat
var aliases;
var admins;
var activeChannels;
//var streamers;
//var streamChannel;
var fs = require("fs");


try {
    aliases = require("./alias.json");
} catch (e) {
    //No aliases defined
    aliases = {};
}

try {
    admins = require("./admins.json");
} catch (e) {
    //No admins defined
    admins = {};
}

try {
    streamChannel = require("./streamChannel.json");
} catch (e) {
    //No streamChannels defined
    streamChannel = {};
}



try {
    activeChannels = require("./activeChannels.json");
} catch (e) {
    //No activeChannels defined
    activeChannels = {};
}

try {
    streamers = require("./streamers.json");
} catch (e) {
    //No streamers defined
    streamers = {};
}

var https = require('https');
var http = require('http');
//TODO: make it so this is in a server by server basis
var allowWords = true;
//hardcoded commands stored as a javascript object
var commands = {

    "say": {
        //TODO: disbale non admins from @everyoneing
        usage: "<message bot will say>",
        admin: false,
        description: "bot does what he is told",
        onlyInActive: false,
        process: function(bot, msg, suffix) {
            bot.sendMessage(msg.channel, suffix);
        }
    },

    "alias": {
        usage: "<name> <actual command>",
        admin: true,
        onlyInActive: false,
        description: "ADMIN ONLY: Creates command aliases. Useful for making simple commands on the fly",
        process: function(bot, msg, suffix) {
            if (msg.channel.isPrivate) {
                //not in dms
                console.log("no alias in dms");
                return;
            }
            var args = suffix.split(" ");
            var name = args.shift();
            if (!name) {
                bot.sendMessage(msg.channel, "!alias " + this.usage + "\n" + this.description);
            } else if (commands[name] || name === "help") {
                bot.sendMessage(msg.channel, "overwriting commands with aliases is not allowed!");
            } else {
                var command = args.shift();
                name = name.toLowerCase();
                aliases[name] = [command, args.join(" ")];
                //now save the new alias
                require("fs").writeFile("./alias.json", JSON.stringify(aliases, null, 2), null);
                bot.sendMessage(msg.channel, "created alias " + name);
            }
        }
    },

    "randpic": {
        usage: "<folderpath>",
        description: "Grabs a random picture from a folder in the bot's directory (use it for aliases)",
        onlyInActive: true,
        process: function(bot, msg, suffix) {
            var possiblePaths = [
                    "./pics/mikeross/",
                    "./pics/GT/",
                    "./pics/"
                ]
                //check if path provdied is allowed
            for (var tmp in possiblePaths) {
                if (possiblePaths[tmp] == suffix.trim()) {
                    getRandomPicFromFolder(suffix.trim(), msg);
                }
            }
        }
    },

    "loli": {
        description: "gets your fix",
        admin: false,
        onlyInActive: false,
        process: function(bot, msg, suffix) {
            var pictureName = "img_chris-hansen.jpg";
            var readableStream = require("fs").createReadStream("./pics/" + pictureName);
            bot.sendFile(msg.author, readableStream, pictureName);
        }
    },

    //checks first if user is admin by if they can ban ppl or manage roles
    //if they can do one of those it adds their highest role to the admin list so isUserAdmin will work
    "setadmin": {
        description: "used by admins(checks if user can ban or manage roles) to set the admin role on the server",
        admin: false,
        onlyInActive: false,
        process: function(bot, msg, suffix) {
            if (msg.channel.isPrivate) {
                //not in dms
                console.log("no setadmin in dms");
                return;
            }
            var user_permissions = msg.channel.permissionsOf(msg.author);
            if (user_permissions.hasPermission("banMembers") || user_permissions.hasPermission("manageRoles")) {
                var server = msg.channel.server;
                var topRole = server.rolesOfUser(msg.author)[0];
                if (topRole) {
                    admins[server.id] = topRole.id;
                    //write admins
                    require("fs").writeFile("./admins.json", JSON.stringify(admins, null, 2), null);
                    bot.sendMessage(msg.channel, "added admin role: " + topRole.name);
                } else {
                    bot.sendMessage(msg.channel, "you are the server creator without any roles, make some roles for this command to work");
                }

            } else {
                bot.sendMessage(msg.channel, "You are not an admin");
            }
        }
    },

    "showadmins": {
        description: "lists the admins on the server",
        admin: false,
        onlyInActive: true,
        process: function(bot, msg, suffix) {
            if (msg.channel.isPrivate) {
                //not in dms
                console.log("no showadmins in dms");
                return;
            }
            var server = msg.channel.server;
            var roleId = admins[server.id];
            if (roleId) {
                //if id found
                var adminNames = "";
                var members = server.members;
                for (var i = 0; i < members.length; i++) {
                    var isAdmin = false;
                    var rolesArr = server.rolesOfUser(members[i]);
                    for (var j = 0; j < rolesArr.length; j++) {
                        if (rolesArr[j].id == roleId)
                            isAdmin = true;
                    }
                    var user_permissions = msg.channel.permissionsOf(members[i]);
                    if (isAdmin || user_permissions.hasPermission("manageServer")) {
                        adminNames += members[i].name;
                        adminNames += ", ";
                    }
                }
                if (adminNames !== "") {
                    adminNames = adminNames.substring(0, adminNames.length - 2);
                }
                bot.sendMessage(msg.channel, "admins: " + adminNames);
            } else {
                bot.sendMessage(msg.channel, "admins not set");
            }

        }
    },

    "makechannelactive": {
        description: "ADMIN ONLY: makes the channel active so bot commands will work",
        admin: true,
        onlyInActive: false,
        process: function(bot, msg, suffix) {
            if (msg.channel.isPrivate) {
                //not in dms
                console.log("no makechannelactive in dms");
                return;
            }
            if (!isChannelActive(msg)) {
                var server = getServer(msg);
                var serverActiveChannels = activeChannels[server.id];
                if (!serverActiveChannels) {
                    serverActiveChannels = [];
                }
                if (serverActiveChannels.indexOf(msg.channel.id) == -1) {
                    //channel not added yet
                    serverActiveChannels.push(msg.channel.id)
                }
                activeChannels[server.id] = serverActiveChannels;
                //write activeChannels
                require("fs").writeFile("./activeChannels.json", JSON.stringify(activeChannels, null, 2), null);
            }
            bot.sendMessage(msg.channel, "channel now active");
        }
    },

    "deactivatechannel": {
        description: "ADMIN ONLY: makes the channel not active so bot will not work",
        admin: true,
        onlyInActive: true,
        process: function(bot, msg, suffix) {
            if (msg.channel.isPrivate) {
                //not in dms
                console.log("no deactivatechannel in dms");
                return;
            }
            var server = getServer(msg);
            var serverActiveChannels = activeChannels[server.id];
            var toRemove = serverActiveChannels.indexOf(msg.channel.id);
            var tmp = [serverActiveChannels.length - 1];
            for (var i = 0; i < serverActiveChannels.length; i++) {
                if (i !== toRemove) {
                    var tmpNum = i;
                    if (tmpNum > toRemove) {
                        tmpNum = tmpNum - 1;
                    }
                    tmp[tmpNum] = serverActiveChannels[i];
                }
            }
            activeChannels[server.id] = tmp;
            //write activeChannels
            require("fs").writeFile("./activeChannels.json", JSON.stringify(activeChannels, null, 2), null);
            bot.sendMessage(msg.channel, "channel now NOT active");
        }
    },

    // "ischannelactive": {
    //     admin: false,
    //     process: function(bot, msg, suffix) {
    //         if (isChannelActive(msg)) {
    //             bot.sendMessage(msg.channel, "channel active");
    //         } else {
    //             bot.sendMessage(msg.channel, "channel NOT active");
    //         }
    //     }
    // },

    "imguralbum": {
        usage: "<link to album>",
        admin: false,
        onlyInActive: true,
        description: "posts a random picture from the album passed",
        process: function(bot, msg, suffix) {
            var imgur = require("imgur");
            var tmp = suffix.lastIndexOf('/');
            var album = suffix.substring(tmp + 1);

            imgur.getAlbumInfo(album).then(function(json) {
                //console.log(json.data.images);
                var imgs = json.data.images;
                var links = [];
                for (var img in imgs) {
                    //console.log("img: " + img);
                    links.push(imgs[img].link);
                }
                //console.log(links);
                var randomNum = Math.floor(Math.random() * links.length);
                bot.sendMessage(msg.channel, links[randomNum]);
            }).catch(function(err) {
                console.error(err.message);
            });
        }
    },

    "joke": {
        description: "funny",
        admin: false,
        onlyInActive: false,
        process: function(bot, msg, suffix) {
            http.get("http://tambal.azurewebsites.net/joke/random", (res) => {
                res.on('data', (d) => {
                    bot.sendMessage(msg.channel, JSON.parse(d).joke);
                });
            }).on('error', (e) => {
                console.error(e);
            });
        }
    },

    "changename": {
        usage: "<name to change to>",
        description: "ADMIN ONLY: changes bot name",
        admin: true,
        onlyInActive: false,
        process: function(bot, msg, suffix) {
            if (msg.channel.isPrivate) {
                //not in dms
                console.log("no changename in dms");
                return;
            }
            bot.setUsername(suffix, function(error) {
                throw error;
                console.log(error);
            });
            bot.sendMessage(msg.channel, "changed name to " + suffix);
        }
    },

    "togglewords": {
        description: "ADMIN ONLY: bot will check for some special words when the msg did not start with !",
        admin: true,
        onlyInActive: false,
        process: function(bot, msg, suffix) {
        	if (msg.channel.isPrivate) {
                //not in dms
                console.log("no remove streamer in dms");
                return;
            }
            allowWords = !allowWords;
            if (allowWords == true) {
                bot.sendMessage(msg.channel, "special words allowed");
            } else {
                bot.sendMessage(msg.channel, "special NOT words allowed");
            }
        }
    },
    "addstreamer": {
        usage: "<TwitchUserName>",
        description: "ADMIN ONLY: will send a msg to #streams when this streamer goes live",
        admin: true,
        onlyInActive: false,
        process: function(bot, msg, suffix) {
        	if (msg.channel.isPrivate) {
                //not in dms
                console.log("no remove streamer in dms");
                return;
            }
            streamers[suffix] = {
                "active": true,
                "lastCheck": false
            };
            require("fs").writeFile("./streamers.json", JSON.stringify(streamers, null, 2), null);
            bot.sendMessage(msg.channel, "now checking for " + suffix + " to go live");
        }
    },
    "removestreamer": {
        usage: "<TwitchUserName>",
        description: "ADMIN ONLY: removes stream from check list",
        admin: true,
        onlyInActive: false,
        process: function(bot, msg, suffix) {
            if (msg.channel.isPrivate) {
                //not in dms
                console.log("no remove streamer in dms");
                return;
            }
            streamers[suffix] = {
                "active": false,
                "lastCheck": false
            };
            require("fs").writeFile("./streamers.json", JSON.stringify(streamers, null, 2), null);
            bot.sendMessage(msg.channel, "removed: " + suffix);
        }
    },
    "setstreamchannel": {
        description: "ADMIN ONLY: run this in the channel you want the auto stream notifications to go",
        admin: true,
        onlyInActive: false,
        process: function(bot, msg, suffix) {
        	if (msg.channel.isPrivate) {
                //not in dms
                console.log("no streamchannel in dms");
                return;
            }
            streamChannel[getServer(msg).id] = {
                "channel": msg.channel.id,
                "active": true
            };
            require("fs").writeFile("./streamChannel.json", JSON.stringify(streamChannel, null, 2), null);
            bot.sendMessage(msg.channel, "this channel is now stream channel");
        }
    },

    "isstreamchannel": {
        description: "DEBUG ADMIN: used to check if this channel is the stream channel",
        admin: true,
        onlyInActive: false,
        process: function(bot, msg, suffix) {
        	if (msg.channel.isPrivate) {
                //not in dms
                console.log("no streamchannel in dms");
                return;
            }
            console.log("channel id: " + msg.channel.id);
            var id = streamChannel[getServer(msg).id].channel;
            if (id === msg.channel.id) {
                bot.sendMessage(msg.channel, "this channel is stream channel");
            } else {
                bot.sendMessage(msg.channel, "this channel is not stream channel");
            }

        }
    },

    "streamsbeingchecked": {
        description: "ADMIN ONLY: will list all streams being check to go live",
        admin: true,
        onlyInActive: false,
        process: function(bot, msg, suffix) {
            var tmp = "";
            //console.log("streamers: " + streamers.getOwnPropertyNames());
            //for(var i = 0; i < streamers; i++){
            //console.log("streamers["+i+"]: " + streamers[i])
            //tmp += streamers[i];
            //tmp += " ";
            //}
            for (var i in streamers) {
                if (streamers.hasOwnProperty(i) && streamers[i].active) {
                    tmp += i;
                    tmp += " ";
                    console.log(i + ": " + streamers[i]);
                }
            }
            bot.sendMessage(msg.channel, "streams being checked: " + tmp);
        }
    },

    "togglecheckstreams": {
        description: "ADMIN ONLY: toggles the auto stream check",
        admin: true,
        onlyInActive: false,
        process: function(bot, msg, suffix) {
        	if (msg.channel.isPrivate) {
                //not in dms
                console.log("no togglestreamcheck in dms");
                return;
            }
            var tmp = streamChannel[getServer(msg).id];
            tmp.active = !tmp.active;
            var info = "streams will now NOT be checked";
            if (tmp.active) {
                info = "streams will now be checked";
            }
            streamChannel[getServer(msg).id] = tmp;
            require("fs").writeFile("./streamChannel.json", JSON.stringify(streamChannel, null, 2), null);
            bot.sendMessage(msg.channel, info);
        }
    },

    "checkstreams": {
        description: "ADMIN ONLY: will list all streams being check to go live",
        admin: false,
        onlyInActive: true,
        process: function(bot, msg, suffix) {
            checkStreams(msg.channel);
            //checkStreamsHelp();
        }
    },

    "liststreamers": {
        description: "ADMIN: lists the streamers to check when they go live",
        admin: true,
        onlyInActive: true,
        process: function(bot, msg, suffix) {
        	var info = "";
            for (var i in streamers) {
                if (streamers.hasOwnProperty(i) && streamers[i].active) {
                  info += i;
                  info += ", ";
                }
            }
            if(info == ""){
            	bot.sendMessage(msg.channel, "no streamers checked");
            }
            else{
            	info = info.substring(0, info.length - 2);
            	bot.sendMessage(msg.channel, "checking " + info);
            }
        }
    },

}


function checkStreamsHelp() {
    for (tmp in streamChannel) {
        if (streamChannel[tmp].active) {
            checkStreams(streamChannel[tmp].channel);
        }
    }
}

//when the bot is ready
bot.on("ready", function() {
    console.log("Ready to begin! Serving in " + bot.channels.length + " channels");
    try {
        var CronJob = require('cron').CronJob;
        var job = new CronJob({
            cronTime: '00 00 0-23 * * *',
            onTick: function() {
                console.log("running cron")
                    /*
                     * Runs on the hr every hr
                     */
                checkStreamsHelp();
            },
            start: false,
        });
        job.start();
    } catch (e) {
        //cron not found
        console.log("cron not found");
    }
    //checkStreams();
});

//when the bot disconnects
bot.on("disconnected", function() {
    //alert the console
    console.log("Disconnected!");

    //exit node.js with an error
    process.exit(1);
});

//when the bot receives a message
bot.on("message", function(msg) {
    //check to make sure msg was not from bot and the msg started with an !
    if (msg.author.id != bot.user.id) {
        if (msg.content[0] === '!') {
            console.log("treating " + msg.content + " from " + msg.author.username + " as command");
            //the command that was run with out any of the modifers on it
            var cmdTxt = msg.content.split(" ")[0].substring(1);
            //arguments on that command
            var suffix = msg.content.substring(cmdTxt.length + 2); //add one for the ! and one for the space

            //get the commands object to pull up the object for the command entered(it there was one)
            cmdTxt = cmdTxt.toLowerCase();
            //console.log(cmdTxt);

            var alias = aliases[cmdTxt];
            if (alias) {
                cmdTxt = alias[0];
                suffix = alias[1] + " " + suffix;
            }
            var cmd = commands[cmdTxt];
            if (cmdTxt === "help") {
				printHelp(msg);
            } else if (cmd) {
                //command matched
                try {
                    if (checkCmd(cmd, msg))
                        cmd.process(bot, msg, suffix);
                    else
                        console.log(cmdTxt + " was not run")
                } catch (e) {
                    //error in the command when ran
                    bot.sendMessage(msg.channel, "I tried to run your command but it failed, like everything else you do");

                    console.log("command " + cmdTxt + " failed :(\n" + e.stack);
                }
            } else {
                //command did not match
                //bot.sendMessage(msg.channel, "command not found");
                console.log("command not found")
            }
        } else {
            //not from bot but didnt start with !
            if (allowWords) {
                if (msg.content === "ayy") {
                    bot.sendMessage(msg.channel, "lmao");
                }
            }
        }
    }
});

//checks if the user who sent the msg can run the passed command in the channel
//returns true if the user can run, false otherwise
function checkCmd(cmd, msg) {
    if (msg.channel.isPrivate) {
        //make all cmds work in dms
        return true;
    }
    //console.log("admin:" + cmd.admin + " active: " + cmd.onlyInActive)
    //console.log(Object.getOwnPropertyNames(cmd).toString())
    var adminCheck = false
    if (cmd.admin) {
        //console.log("admin def")
        if (isUserAdmin(msg)) {
            //console.log("passed admin")
            adminCheck = true;
        }
    } else {
        //console.log("admin not def/is false")
        adminCheck = true;
    }
    if (adminCheck) {
        //if passed admin check
        if (cmd.onlyInActive) {
            //
            if (isChannelActive(msg)) {
                return true;
            } else {
                //channel not active
                return false;
            }
        } else {
            //only in active false
            return true;
        }
    } else {
        //didnt pass admin check
        return false;
    }

}


//returns a string that is a filename found in the folderpath
function getRandomPicFromFolder(folderPath, msg) {
    //var files = fs.readdirSync(folderPath); //array of files found  
    fs.readdir(folderPath, (err, files) => {
        if (err) throw err;
        var newArr = []
            //var numPics = 0;
        for (var file in files) {
            //console.log("did stuff on: " + picture)
            var picture = files[file];
            if (picture.match(".jpg$") || picture.match(".png$") || picture.match(".gif$")) {
                //numPics++;
                newArr.push(picture);
            }
        }
        files = newArr;
        console.log("files after: " + files.length);
        var randomNum = Math.floor(Math.random() * files.length);
        //console.log("chosen file:" + files[randomNum]);
        postPic(msg, folderPath, files[randomNum]);
    });
}


function postPic(msg, folderPath, pictureName) {
    var readableStream = require("fs").createReadStream(folderPath + pictureName);
    bot.sendFile(msg.channel, readableStream, pictureName);
}

function isUserAdmin(msg) {
    var user_permissions = msg.channel.permissionsOf(msg.author);
    if (user_permissions.hasPermission("manageServer")) {
        return true;
    }
    var server = msg.channel.server;
    //  console.log("server name: " + server.name);
    //  var tmp = server.roles;
    //  console.log("server roles: " + tmp[0].name);


    //    var user_permissions = msg.channel.permissionsOf(msg.author);
    //    if (user_permissions.hasPermission("banMembers") || user_permissions.hasPermission("manageRoles")) {
    //        return true;
    //    }
    //    return false;
    var roleId = admins[server.id];
    var isAdmin = false;
    if (roleId) {
        var rolesArr = server.rolesOfUser(msg.author);
        for (var j = 0; j < rolesArr.length; j++) {
            if (rolesArr[j].id == roleId)
                isAdmin = true;
        }
    } else {
        console.log("!!!!NO ADMINS SET!!!!")
    }

    return isAdmin;
}

function checkIfStreamIsOffline(channel, twitchName) {
    //do JSON.parse(d) look at !joke
    var url = "https://api.twitch.tv/kraken/streams/" + twitchName;
    var online = false;
    https.get(url, (res) => {
        res.on('data', (d) => {
            var tmp = d.toString().search('"stream":null');
            if (tmp != -1) {
                console.log(twitchName + " is offline")
            } else {
                console.log(twitchName + " is online")
                bot.sendMessage(channel, twitchName + " is online http://www.twitch.tv/" + twitchName);
            }
        });

    }).on('error', (e) => {
        console.error(e);
    });
}

function isChannelActive(msg) {
    var server = getServer(msg);
    var serverActiveChannels = activeChannels[server.id];
    if (serverActiveChannels) {
        if (serverActiveChannels.indexOf(msg.channel.id) != -1) {
            return true;
        }
    }
    return false;
}

//returns the server the msg was sent in
function getServer(msg) {
    return msg.channel.server;
}

function checkStreams(channel) {
    for (var i in streamers) {
        if (streamers.hasOwnProperty(i) && streamers[i].active) {
            checkIfStreamIsOffline(channel, i);
            //console.log(i + "online: " + checkIfStreamIsOffline(i));
        }
    }
}

function printHelp(msg) {
    //do help stuff
    bot.sendMessage(msg.author, "-------Available Commands-------", function() {
        for (var cmd in commands) {
            //first check if this cmd is an admin cmd and if user is not an admin
            //if so skip
            if (commands[cmd].admin) {
                if (commands[cmd].admin === true && !isUserAdmin(msg)) {
                    continue;
                }
            }
            var info = "!" + cmd;
            var usage = commands[cmd].usage;
            if (usage) {
                info += " " + usage;
            }
            if (commands[cmd].onlyInActive) {
                info += " (only in active channels)"
            }

            var description = commands[cmd].description;
            if (description) {
                info += "\n\t" + description;
            }

            bot.sendMessage(msg.author, info);
        }
        for (var cmd in aliases) {
            bot.sendMessage(msg.author, "!" + cmd);
        }
    });
}


bot.login(AuthDetails.email, AuthDetails.password);

