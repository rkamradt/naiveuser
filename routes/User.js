const Redis = require('ioredis')
const uuidv1 = require('uuid/v1')
const bcrypt = require('bcrypt')
const fetch = require('node-fetch')

const client = new Redis(6379, 'redis')
const userKey = 'users:'
const accountKey = 'account:'

module.exports = class User {
  constructor(username, fullname, email, hash, walletId, accounts) {
    this.username = username
    this.fullname = fullname
    this.email = email
    this.hash = hash
    this.walletId = walletId
    this.accounts = accounts ? accounts : []
  }
  saveUser(next) {
    const data = JSON.stringify({
      password: this.getWalletPassword()
    })
    const user = this
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
    }).then(data => {
      user.walletId = data.id // save the wallet id for later
      client.set(userKey + user.username, JSON.stringify(user))
      return next(null);
    }).catch(err => {
      console.log("error returned from naivecoin " + err)
      return next(err);
    })
  }
  static isValid(userId, password, next) {
    client.get(userKey + userId, (err, data) => {
      if(err) return next(err)
      if(!data) return next("not found")
      data = JSON.parse(data)
      bcrypt.compare(password, data.hash, (err, valid) => {
        if(err) return next(err)
        if(valid) {
          const user = new User(data.username, data.fullname, data.email, data.hash, data.walletId, data.accounts)
          return next(null, user)
        }
        return next("forbidden")
      })
    })
  }
  static getAllUsers(next) {
    client.keys(userKey + '*', next)
  }
  getAccount(id, next) {
    const user = this
    client.get(accountKey+id, (err, account) => {
      if(err) return next(err)
      if(!account) return next('not found')
      account = JSON.parse(account)
      if(account.username != user.username) return next('not found')
      return next(null, account)
    })
  }
  saveAccount(next) {
    const user = this
    fetch('http://naivecoin:3001/operator/wallets/'+user.walletId+'/addresses', {
      method: 'POST',
      headers:{
        'password': user.getWalletPassword(),
        'Content-Type': 'application/json',
        'accepts': 'application/json'
      }
    }).then(response => {
      if (!response.ok) {
        console.log("error returned from naivecoin " + response.statusText);
        throw Error(response.statusText);
      }
      return response.json()
    }).then(data => {
      const account = {
        id: uuidv1(),
        username: user.username,
        addressId: data.address
      }
      user.accounts.push(account.id)
      client.set(userKey + user.username, JSON.stringify(user))
      client.set(accountKey + account.id, JSON.stringify(account))
      next(null, account)
    }).catch(err => {
      console.log("error returned from naivecoin " + err);
      next(err);
    })
  }
  getWalletPassword() {// naive coin requires passwords with at least five words:
    return this.username + ' ' + this.email + ' ' + this.hash + ' two more words'
  }
}
