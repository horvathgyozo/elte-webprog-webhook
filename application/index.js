import express from 'express'
import bodyParser from 'body-parser'
import childProcess from 'child_process'
import CryptoJS from 'crypto-js'

import config from '../config/config.json'

const server = express()

function exec (cmd, workingDir) {
  return new Promise(function (resolve, reject) {
    console.log(`\t\t\t\t\t WorkingDir:\t${workingDir}\n>> ${cmd}`)

    childProcess.exec(cmd, { cwd: workingDir }, function (err, stdout, stderr) {
      if (err) {
        return reject(err, stderr)
      } else {
        return resolve(stdout)
      }
    })
  })
}

server.use(bodyParser.json())

server.post('/webhook', function (req, res) {
  const remoteAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress
  console.log(`------------------------`)
  console.log(`++ POST request recieved \t\t RemoteAddr:\t${remoteAddress}`)

  const repository = req.body.repository['full_name']
  const remoteSecret = req.headers['x-hub-signature']
  const localSecret = 'sha1=' + CryptoJS.HmacSHA1(JSON.stringify(req.body), config.github.secret)

  if (repository && remoteSecret) {
    console.log(`++ Webhook request \t\t\t Repository:\t${repository}`)
    console.log(`++ Secret \t\t\t\t Remote:\t${remoteSecret}`)
    console.log(`++ Secret \t\t\t\t Local:\t\t${localSecret}`)
  }

  const repoMatch = (repository === config.github.repository)
  const secretMatch = (remoteSecret === localSecret)

  if (repoMatch && secretMatch) {
    const gitCmd = `git pull`
    const buildCmd = `bundle exec jekyll build`
    const deployCmd = `cp -R _site/* ${config.publicPath}`

    exec(gitCmd, config.repositoryPath)
      .then(function (stdout) {
        console.log(stdout)
        return exec(buildCmd, config.repositoryPath)
      })
      .then(function (stdout) {
        console.log(stdout)
        return exec(deployCmd, config.repositoryPath)
      })
      .then(function (stdout) {
        console.log(stdout)
        res.status(200)
        res.json({
          status: 200,
          message: 'Webhook executed successfully'
        })
      })
      .catch(function (err, stderr) {
        console.error(stderr)
        res.status(500)
        res.json({
          status: 500,
          message: 'Could not process GitHub request',
          error: err.message
        })
      })
  } else {
    res.status(403)
    res.json({
      status: 403,
      message: 'Repository or remoteSecret mismatch'
    })
  }
})

server.listen(config.port, function () {
  console.log(`++ GitHub Webhook server started \t Port:\t\t${config.port}`)
})
