var express = require('express')
var router = express.Router()
var Redis = require('ioredis')
var uuidv1 = require('uuid/v1')
var bcrypt = require('bcrypt')
var fetch = require('node-fetch')

var client = new Redis(6379, 'redis')

/* GET list of users */
router.get('/users', (req, res, next) => {
  client.keys('users:*', (err, ids) => {
    if(err) return next(err);
    return res.send(JSON.stringify(ids)).end()
  })
})
/* GET specific user */
router.get('/users/:id', (req, res, next) => {
  if(!req.headers.password) {
    return res.status(403).send('password header required').end();
  }
  client.get('users:' + req.params.id, (err, data) => {
    if(err) return next(err)
    if(!data) return res.status(404).send('user not found').end()
    data = JSON.parse(data)
    bcrypt.compare(req.headers.password, data.hash, (err, valid) => {
      if(err) return next(err);
      if(valid) {
        var user = {
          username: data.username,
          fullname: data.fullname,
          email: data.email,
          walletId: data.walletId
        }
        return res.send(user).end()
      }
      return res.status(403).send('none shall pass').end()
    })
  })
})
/* create new user */
router.post('/users', (req, res) => {
  bcrypt.hash(req.body.password, 10, (err, hash) => {
    var user = {
      username: req.body.username,
      fullname: req.body.fullname,
      email: req.body.email,
      hash: hash,
      walletId: null
    }
    const data = JSON.stringify({ // naive coin requires passwords with at least five words:
      password: user.username + ' ' + user.email + ' ' + user.hash + ' two more words'
    })
    fetch('http://naivecoin:3001/operator/wallets', {
      method: 'POST',
      body: data,
      headers:{
        'Content-Type': 'application/json',
        'accepts': 'application/json'
      }
    }).then(response => {
        if (!response.ok) {
          console.log("error returned from naivecoin " + response.statusText);
          throw Error(response.statusText);
        }
        return response.json()
      })
      .then(data => {
        console.log("created wallet with id " + data.id)
        user.walletId = data.id; // save the wallet id for later
        client.set('users:' + req.body.username, JSON.stringify(user))
        res.status(201).end()
      })
      .catch(err => {
        console.log("error returned from naivecoin " + err);
        res.status(502).end(); // use bad gateway to indicate unexpectedly failed upstream service
      })
  })
})

module.exports = router
