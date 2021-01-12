#!/usr/bin/env node

var fs = require('fs')
var path = require('path')
var querystring = require('querystring')
var axios = require('axios')
var FormData = require('form-data')

let config
let to = promise => promise.then(data => [null, data]).catch(err => [err, undefined])
let vm = {
  arr: [],
  // 获取文件
  async get() {
    let arr = []
    let getFiles = async (filePath = '', fileName = '') => {
      let p = path.join(__dirname, config.outputDir, filePath, fileName)
      let [err, stats] = await to(fs.promises.stat(p))
      err && console.log(err)
      // 目录
      if (stats && stats.isDirectory()) {
        filePath = (filePath ? `${filePath}/` : '') + fileName
        let [err, dirs] = (await to(fs.promises.readdir(p))) || []
        err && console.log(err)
        for (var i = 0; i < dirs.length; i++) {
          await getFiles(filePath, dirs[i])
        }
      }
      // 文件
      else if (stats && stats.isFile()) {
        arr.push({ filePath, fileName })
      }
    }

    await getFiles()

    this.arr = arr
    // console.log(arr)
  },
  // 文件是否存在
  async isExist(n) {

    let { data } = await axios({
      method: 'POST',
      url: config.isExistUrl,
      data: querystring.stringify({
        'bucket_name': config.bucketName,
        'key': config.key,
        'keys': n.fileName,
      }),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'asset-key': config.assetKey,
        'user-token': config.userToken,
      }
    })
    // console.log(data)
    if (data && data.result && data.result[0] && data.result[0].exist === false) {
      // console.log(config.key + n.fileName, '没有上传过')
    }
    else if (data && data.result && data.result[0] && data.result[0].exist === true) {
      // console.log(config.key + n.fileName, '已上传过')
    }
    else {
      console.log('-------------isExist err --------------')
    }

    await this.upload(n)
  },
  // 上传
  async upload(n) {
    let form = new FormData()
    form.append('bucket_name', config.bucketName)
    form.append('key', config.key)
    form.append('file', fs.createReadStream(path.resolve(__dirname, config.outputDir, n.filePath, n.fileName)))

    let { data } = await axios({
      method: 'POST',
      url: config.uploadUrl,
      data: form,
      headers: {
        ...form.getHeaders(),
        'asset-key': config.assetKey,
        'user-token': config.userToken,
      }
    })

    if (data && data.code === 0) {
      console.log('上传文件:', config.key + n.fileName, '成功')
    }
    else {
      console.log(data, config.key + n.fileName)
    }
  },
  getConfig() {

  },
  async init() {
    try {
      config = require(path.resolve(process.cwd(), './upfile.config.js'))
    } catch (error) { }
    if (!(config.assetKey && config.userToken && config.bucketName && config.key && config.outputDir)) {
      console.log('upfile.config.js 配置信息不全')
      return
    }
    console.log(new Date().toLocaleString(), 'bucket:', config.bucketName, '目录:', config.key)

    await this.get()

    this.arr = this.arr.filter(n => {
      let ext = n.fileName.match(/[^\.]*$/)[0]
      return ['js', 'css'].indexOf(ext) >= 0
    })

    for (var i = 0; i < this.arr.length; i++) {
      let n = this.arr[i]
      await this.isExist(n, i)
    }
  }
}
vm.init()