var express = require('express');
var bodyParser = require('body-parser');
var mongoose = require('mongoose');
var User = require('./models/user');
var Message = require('./models/message');

var app = express();

var jsonParser = bodyParser.json();
var bcrypt = require('bcrypt');

var passport = require('passport');
var BasicStrategy = require('passport-http').BasicStrategy;

var strategy = new BasicStrategy(function(username, password, callback) {
  User.findOne({
    username: username
  }, function(err, user) {
    if (err) {
      callback(err);
      return;
    }

    if (!user) {
      return callback(null, false, {
        message: 'Incorrect username.'
      });
    }

    user.validatePassword(password, function(err, isValid) {
      if (err) {
        return callback(err);
      }

      if (!isValid) {
        return callback(null, false, {
          message: 'Incorrect password.'
        });
      }
      return callback(null, user);
    });
  });
});

passport.use(strategy);
app.use(passport.initialize());

/*===================================

         '/user' Endpoint

====================================*/

// GET request for all users
app.get('/users', passport.authenticate('basic', {
  session: false
}), function(req, res) {
  // The '.find' callback returns an array of Users
  User.find(null, 'username _id', function(err, users) {
    if (err) {
      return res.status(400).json(err);
    }
    res.status(200).json(users);
  });
});

// POST Request that creates new user document
app.post('/users', jsonParser, function(req, res) {
  if (!req.body) {
    return res.status(400).json({
      message: "No request body"
    });
  }

  if (!('username' in req.body)) {
    return res.status(422).json({
      message: 'Missing field: username'
    });
  }

  var username = req.body.username;

  if (typeof username !== 'string') {
    return res.status(422).json({
      message: 'Incorrect field type: username'
    });
  }

  username = username.trim();

  if (username === '') {
    return res.status(422).json({
      message: 'Incorrect field length: username'
    });
  }

  if (!('password' in req.body)) {
    return res.status(422).json({
      message: 'Missing field: password'
    });
  }

  var password = req.body.password;

  if (typeof password !== 'string') {
    return res.status(422).json({
      message: 'Incorrect field type: password'
    });
  }

  password = password.trim();

  if (password === '') {
    return res.status(422).json({
      message: 'Incorrect field length: password'
    });
  }

  bcrypt.genSalt(10, function(err, salt) {
    if (err) {
      return res.status(500).json({
        message: 'Internal server error'
      });
    }

    bcrypt.hash(password, salt, function(err, hash) {
      if (err) {
        return res.status(500).json({
          message: 'Internal server error'
        });
      }

      var user = new User({
        username: username,
        password: hash
      });

      user.save(function(err) {
        if (err) {
          return res.status(500).json({
            message: 'Internal server error'
          });
        }

        return res.header('location', '/users/' + user._id).status(201).json({});
      });
    });
  });
});


/*================================

       '/user/:id' Endpoint

=================================*/

// GET Request for individual user
app.get('/users/:userId', passport.authenticate('basic', {
  session: false
}), function(req, res) {
  var userId = req.params.userId;

  // Find user using variable
  User.findById(userId, 'username _id', function(err, user) {
    
    // Send error if no user is found
    if (!user) {
      return res.status(404).json({
        message: 'User not found'
      });
    }

    if (userId !== req.user._id.toString()) {
      return res.status(422).json({
        message: 'Please send from your username'
      });
    }

    res.status(200).json(user);
  });
});


// PUT Request to update existing user or create one if it doesn't exist
app.put('/users/:userId', jsonParser, passport.authenticate('basic', {
  session: false
}), function(req, res) {
  var userId = req.params.userId;
  // Object that will create new user if it doesn't exist
  var options = {
    upsert: true,
    setDefaultsOnInsert: true
  };

  if (userId !== req.user._id.toString()) {
    return res.status(401).json({
      message: 'You must edit your own profile'
    })
  }
  // Send error if username field is empty
  // if (!newName) {
  //   return res.status(422).json({
  //     message: 'Missing field: username'
  //   });
  // }
  // // Send error if username provided isn't a string
  // else if (typeof(newName) !== 'string') {
  //   return res.status(422).json({
  //     message: 'Incorrect field type: username'
  //   });
  // }

  // Set new password
  var password = req.body.password;

  if (typeof password !== 'string') {
    return res.status(422).json({
      message: 'Incorrect field type: password'
    });
  }

  password = password.trim();

  if (password === '') {
    return res.status(422).json({
      message: 'Incorrect field length: password'
    });
  }

  bcrypt.genSalt(10, function(err, salt) {
    if (err) {
      return res.status(500).json({
        message: 'Internal server error'
      });
    }

    bcrypt.hash(password, salt, function(err, hash) {
      if (err) {
        return res.status(500).json({
          message: 'Internal server error'
        });
      }

      User.findOneAndUpdate({
        _id: userId
      }, {
        password: hash
      }, options, function(err, user) {
        // Send back an empty object
        res.status(200).json({});
      });
    });
  });
});


// DELETE Request for individual user
app.delete('/users/:userId', passport.authenticate('basic', {
  session: false
}), function(req, res) {
  var userId = req.params.userId;

  User.findById(userId, function(err, user) {
    // Send error if no user is found
    if (!user) {
      return res.status(404).json({
        message: 'User not found'
      });
    }
    
    if (userId !== req.user._id.toString()) {
      return res.status(401).json({
        message: 'You cannot delete other users'
      });
    }
    
    // Find user by user id
    User.findByIdAndRemove(userId, function(err, user) {
    // Send back an empty object
    res.status(200).json({});
    });
  });
});


/*================================

      '/messages' Endpoint

=================================*/

// GET Request for all messages
app.get('/messages', passport.authenticate('basic', {
  session: false
}), function(req, res) {
  // Expand all messages using .populate, so that all User model properties are
  // accessable from the 'from' and 'to' properties of the Message model
  Message.find(req.query).populate('from to').exec(function(err, messages) {
    if (err) {
      return res.status(400).json(err);
    }
    res.status(200).json(messages);
  });
});

app.post('/testing', passport.authenticate('basic', {
  session: false
}), function(req, res) {
  console.log("REQ", req);
  console.log("REQ.BODY", req.body);
  return res.status(500).json({
    hello: "world"
  });
});
// random comment
// POST Request that creates new message document
app.post('/messages', jsonParser, passport.authenticate('basic', {
  session: false
}), function(req, res) {
  // Send error if empty text field
  if (!req.body.text) {
    return res.status(422).json({
      message: 'Missing field: text'
    });
  }
  // Send error if text isn't a string
  else if (typeof req.body.text !== 'string') {
    return res.status(422).json({
      message: 'Incorrect field type: text'
    });
  }
  // Send error if 'to' isn't a string
  else if (typeof req.body.to !== 'string') {
    return res.status(422).json({
      message: 'Incorrect field type: to'
    });
  }
  // Send error if 'from' isn't a string
  else if (typeof req.body.from !== 'string') {
    return res.status(422).json({
      message: 'Incorrect field type: from'
    });
  }

  /* Since Mongoose methods execute asynchronously, we nest
     them so each executes after previous function completes */
  // Send error if 'from' user doesn't exist
  var userId = req.user._id.toString();
  var fromId = req.body.from;

  User.findById(fromId, function(err, user) {
    if (err) {
      return res.status(500).json({
        message: 'internal error'
      });
    }
    if (!user) {
      return res.status(422).json({
        message: 'Incorrect field value: from'
      });
    }
    if (fromId !== userId) {
      return res.status(422).json({
        message: 'Please send from your username'
      });
    }

    // Send error if 'to' user doesn't exist
    var toId = req.body.to;
    User.findById(toId, function(err, user) {
      if (err) {
        return res.status(500).json({
          message: 'internal error'
        });
      }
      if (!user) {
        return res.status(422).json({
          message: 'Incorrect field value: to'
        });
      }
      // Create message and set message id to url in Header's location
      Message.create(req.body, function(err, message) {
        if (err) {
          return res.status(500).json({
            message: 'internal error'
          });
        }
        return res.location('/messages/' + message._id).status(201).json({});
      });
    });
  });
});

// this is for travis to see and put into heroku

/*===================================

  '/messages/:messagesId' Endpoint

====================================*/

// GET Request for individual message 
app.get('/messages/:messageId', passport.authenticate('basic', {
  session: false
}), function(req, res) {
  var messageId = req.params.messageId;
  // Find and expand message using .populate, so that all User model properties are
  // accessible from the 'from' and 'to' properties of the Message model
  Message.findById(messageId).populate('from to').exec(function(err, message) {
    // Send error if no message exists
    if (!message) {
      return res.status(404).json({
        message: 'Message not found'
      });
    }
    res.status(200).json(message);
  });
}); 

/*=========== RUN SERVER ============*/
var runServer = function(callback) {
  var databaseUri = process.env.DATABASE_URI || global.databaseUri || 'mongodb://robbykim:travisdeployment@ds011903.mlab.com:11903/travisdeployment';
  mongoose.connect(databaseUri).then(function() {
    var port = process.env.PORT || 8080;
    var server = app.listen(port, function() {
      console.log('Listening on port:' + port);
      if (callback) {
        callback(server);
      }
    });
  });
};

if (require.main === module) {
  runServer();
}

exports.app = app;
exports.runServer = runServer;
