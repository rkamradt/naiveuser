const express = require('express')
const router = express.Router()
const User = require('./User')
const bcrypt = require('bcrypt')

const returnStatus = (res, err) => {
  console.log('in returnStatus err = ' + JSON.stringify(err))
  var code = 400
  if(err === "not found") code = 404
  if(err === "forbidden") code = 403
  if(err && err.toString().startsWith('error returned from naivecoin')) code = 502
  res.status(code).send(err)
}

/* GET list of users */
router.get('/users', (req, res) => {
  User.getAllUsers((err, ids) => {
    if(err) return returnStatus(res, err)
    return res.send(ids)
  })
})
/* GET specific user */
router.get('/users/:user', (req, res) => {
  if(!req.headers.password) {
    return res.status(403).send('password header required')
  }
  User.isValid(req.params.user, req.headers.password, (err, user) => {
    if(err) return returnStatus(res, err)
    if(!user) return res.status(404).send('user not found')
    user.hash = null
    return res.send(user)
  })
})
/* create new user */
router.post('/users', (req, res) => {
  if(!req.body.password) return res.status(400).send('password is required')
  bcrypt.hash(req.body.password, 10, (err, hash) => {
    if(!req.body.username) return res.status(400).send('username is required')
    const user = new User(req.body.username,req.body.fullname,req.body.email,hash)
    user.saveUser(err => {
      if(err) return returnStatus(res, err)
      user.hash = null
      res.status(201).send(user)
    })
  })
})

/* GET list of accounts for a user */
router.get('/users/:user/accounts', (req, res) => {
  if(!req.headers.password) {
    return res.status(403).send('password header required')
  }
  User.isValid(req.params.user, req.headers.password, (err, user) => {
    if(err) return returnStatus(res, err)
    if(!user) return res.status(404).send('user not found')
    res.send(user.accounts)
  })
})
/* GET specific account */
router.get('/users/:user/accounts/:id', (req, res) => {
  if(!req.headers.password) {
    return res.status(403).send('password header required')
  }
  User.isValid(req.params.user, req.headers.password, (err, user) => {
    if(err) return returnStatus(res, err)
    if(!user) return res.status(404).send('user not found')
    user.getAccount(req.params.id, (err, account) => {
      if(err) return returnStatus(res, err)
      res.send(account)
    })
  })
})
/* create new account for a user */
router.post('/users/:user/accounts', (req, res) => {
  if(!req.headers.password) {
    return res.status(403).send('password header required')
  }
  User.isValid(req.params.user, req.headers.password, (err, user) => {
    if(err) return returnStatus(res, err)
    if(!user) return res.status(404).send('user not found')
    user.saveAccount((err, account) => {
      if(err) return returnStatus(err)
      res.send(account)
    })
  })
})
/* mine some coin */
router.post('/users/:user/accounts/:id/mine', (req, res) => {
  if(!req.headers.password) {
    return res.status(403).send('password header required')
  }
  User.isValid(req.params.user, req.headers.password, (err, user) => {
    if(err) return returnStatus(res, err)
    if(!user) return res.status(404).send('user not found')
    user.getAccount(req.params.id, (err, account) => {
      if(err) return returnStatus(res, err)
      user.mine(account, (err) => {
        if(err) return returnStatus(res, err)
        res.send(account)
      })
    })
  })
})

/* transfer some coin */
router.post('/users/:user/accounts/:id/transfer', (req, res) => {
  if(!req.headers.password) {
    return res.status(403).send('password header required')
  }
  if(!req.body.toAccount) return res.status(400).send('toAccount is required')
  if(!req.body.amount) return res.status(400).send('amount is required')
  User.isValid(req.params.user, req.headers.password, (err, user) => {
    if(err) return returnStatus(res, err)
    if(!user) return res.status(404).send('user not found')
    user.getAccount(req.params.id, (err, account) => {
      if(err) return returnStatus(res, err)
      user.getAccount(req.body.toAccount, (err, toAccount) => {
        user.transfer(account, toAccount, req.body.amount, (err) => {
          if(err) return returnStatus(res, err)
          res.send(account)
        })
      })
    })
  })
})

module.exports = router
