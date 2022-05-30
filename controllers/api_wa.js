var express = require('express')
var multiparty = require('multiparty');
var format = require('util').format;
var csv = require('csv-parser');
var path = require('path');
var fs = require('fs');
const venom = require('venom-bot');

var apiWA = express.Router();

const DELAY_BETWEEN_MESSAGES = 500;
const DELAY_BETWEEN_PHONES = 1000;

const PASS_CODE = 'akr111';

apiWA.post('/register', function(req, res, next){
  // check either WA client is available
  if (!checkWAstatus()) {
    res.send('wa still working');
    return;
  }
  // create a form to begin parsing
  var form = new multiparty.Form();
  let phoneNumber;

  form.on('error', next);
  form.on('close', function(){
    // write wa status is pending
    // fs.writeFileSync(path.resolve(__dirname) + '/wa.status', "1");
    registerWAclient(res, cleanPhone(phoneNumber)).catch(e => { console.log('Error during creating client: ' + e.message) });
  });

  // listen on field event for title
  form.on('field', function(name, val){
    if (name == 'phoneSender')  phoneNumber = val;
  });

  // parse the form
  form.parse(req);
});

apiWA.post('/submit', function(req, res, next){
  // check either WA client is available
  if (!checkWAstatus()) {
    res.send('wa still working');
    return;
  }
  // create a form to begin parsing
  var form = new multiparty.Form();
  let codePass;
  let phoneNumber;
  let errMessage;
  let datafile = [];

  form.on('error', next);
  form.on('close', function(){
    if (codePass !== PASS_CODE) {
      res.send('invalid passcode');
      return;
    }
    if (errMessage) {
      res.send(errMessage);
      return;
    }
    // write wa status is pending
    // fs.writeFileSync(path.resolve(__dirname) + '/wa.status', "1");
    createWAclient(res, cleanPhone(phoneNumber), datafile).catch(e => { console.log('Error during creating client: ' + e.message) });
  });


  // listen on field event for title
  form.on('field', function(name, val){
    if (name == 'phoneSender')  phoneNumber = val;
    if (name == 'codePass') codePass = val;
  });

  // listen on part event for image file
  form.on('part', function(part){
    if (!part.filename) return;
    if (part.name !== 'file_csv') return part.resume();

    part.pipe(csv())
    .on('data', (row) => {
      row['phone'] = cleanPhone(row['phone']);
      datafile.push(row);

      // check file either exist
      try {
        let imgList = ['pic1', 'pic2', 'pic3'];
        for(let i = 0; i < imgList.length; i++) {
          if(!row[imgList[i]])   continue;

          let imgPt = path.resolve(__dirname) + "/../static/images/" + row[imgList[i]];
          if (!fs.existsSync(imgPt)) {
            errMessage = row[imgList[i]] + " image doesn't exists, process abort";
            return;
          }
        }
      } catch(err) {
        console.error(err)
      }
    })
    .on('end', () => {
      console.log(`CSV file successfully processed, total entries : ${datafile.length}`);
    })
  });

  // parse the form
  form.parse(req);
});

apiWA.post('/upload', function(req, res, next){
  // create a form to begin parsing
  var form = new multiparty.Form();
  let fileName;

  form.on('error', next);
  form.on('close', function(){
    res.redirect('/list_file');
  });
  form.on('part', function(part){
    if (!part.filename) return;
    fileName = part.filename;
    var target_path = path.resolve(__dirname) + '/../static/images/' + fileName;
    const writeStream = fs.createWriteStream(target_path);
    part.pipe(writeStream);
  });

  // parse the form
  form.parse(req);
});

function checkWAstatus() {
  // temporarily no need to validate
  return true;
  try {
    const data = fs.readFileSync(path.resolve(__dirname) + '/wa.status', {encoding:'utf8', flag:'r'});
    // 0 = ready
    // 1 = waiting another process
    return data == 0;
  }
  catch(err) {console.log(err);}
  return false;
}

async function registerWAclient(res, phoneNumber) {
  venom
  .create(phoneNumber,
    (base64Qr, asciiQR) => {
      //console.log(asciiQR); // Optional to log the QR in the terminal
      var matches = base64Qr.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/),
      response = {};

      if (matches.length !== 3) {
        return new Error('Invalid input string');
      }
      response.type = matches[1];
      response.data = new Buffer.from(matches[2], 'base64');

      var imageBuffer = response;
      require('fs').writeFile(
        'static/images/qrcode/' + phoneNumber + '.png',
        imageBuffer['data'],
        'binary',
        function (err) {
          if (err != null) {
            console.log(err);
          }
        }
      );
    },
    (statusSession, session) => {
      // return: isLogged || notLogged || browserClose || qrReadSuccess || qrReadFail || autocloseCalled || desconnectedMobile || deleteToken
      console.log('Status Session: ', statusSession);
      // create session wss return "serverClose" case server for close
      console.log('Session name: ', session);
      if (statusSession == "isLogged") {
        res.send('Process failed, status = ' + statusSession);
        // write wa status is done
        // fs.writeFileSync(path.resolve(__dirname) + '/wa.status', "0");
      } else if (statusSession == 'notLogged') {
        setTimeout(function() {
          res.send('Please scan this qr code for phone number: ' + phoneNumber + '</br></br>' + '<img src="/images/qrcode/' + phoneNumber + '.png" width="250" />');
        }, 5000);
        // write wa status is done
        // fs.writeFileSync(path.resolve(__dirname) + '/wa.status', "0");
      }
    },
    {autoClose: 60000})
  .then((client) => {
	  console.log('Prepare to closeeeeeeeee');
    client.close();
    // write wa status is done
    // fs.writeFileSync(path.resolve(__dirname) + '/wa.status', "0");
  })
  .catch((err) => {
    console.log(err);
  });
}

async function createWAclient(res, phoneNumber, datafile) {
  venom
  .create(phoneNumber,
    undefined,
    (statusSession, session) => {
      // return: isLogged || notLogged || browserClose || qrReadSuccess || qrReadFail || autocloseCalled || desconnectedMobile || deleteToken
      console.log('Status Session: ', statusSession);
      // create session wss return "serverClose" case server for close
      console.log('Session name: ', session);
      if (statusSession == "isLogged") {
        res.send('Message successfully proceed, please wait for a while');
      } else if( statusSession == "notLogged" ) {
        res.send('Process failed, status = ' + statusSession);
        // write wa status is done
        // fs.writeFileSync(path.resolve(__dirname) + '/wa.status', "0");
      }
    },
    {autoClose: 60000})
  .then((client) => {
    let time = 0;
    client.onStreamChange((state) => {
       console.log('State Connection Stream: ' + state);
       clearTimeout(time);
       if (state === 'DISCONNECTED' || state === 'SYNCING') {
          time = setTimeout(() => {
             client.close();
          }, 80000);
       }
    });
    sendWAmessages(client, datafile);
  })
  .catch((erro) => {
    console.log(erro);
  });
}

async function sendWAmessages(client, datafile) {
  let messages = [
    {
      columnName : 'message1',
      type : 'string',
    },
    {
      columnName : 'message2',
      type : 'string',
    },
    {
      columnName : 'message3',
      type : 'string',
    },
    {
      columnName : 'pic1',
      type : 'image',
    },
    {
      columnName : 'pic2',
      type : 'image',
    },
    {
      columnName : 'pic3',
      type : 'image',
    }
  ];

  let i = 0;
  let total = datafile.length;
  let success = 0;
  let failed = 0;
  let start = Date.now();
  for (i = 0; i < total; i++) {
    let phoneStr = datafile[i]['phone'] + "@c.us";
    let numberExists = true;

    //PATCH, skip if messages and pics are all empty
    //we emptied messages and pics in list if we want to continue broadcast, maybe previous list was interrupted
    let hasContent = false;
    for(let j = 0; j < messages.length; j++) {
      if(datafile[i][messages[j].columnName]) {
        hasContent = true;
        break;
      }
    }
    
    //skip this entry if no content
    if(!hasContent) continue;

    console.log(`${phoneStr} sending...`);

    for(let m = 0; m < messages.length; m++) {
      if(datafile[i][messages[m].columnName] && numberExists) {
        switch(messages[m].type) {
          case 'string':
            try {
              //console.log(phoneStr, "message = ", datafile[i][messages[m].columnName]);
              await client.sendText(phoneStr, datafile[i][messages[m].columnName]);
              sleep(DELAY_BETWEEN_MESSAGES);
            } catch (error){
              console.log(error);
              failed++;
              numberExists = false;
            }
            break;
          case 'image':
            try {
              //console.log(phoneStr, "image = ", imgPath);
              let imgPath = path.resolve(__dirname) + "/../static/images/" + datafile[i][messages[m].columnName];
              await client.sendImage(phoneStr, imgPath);
              sleep(DELAY_BETWEEN_MESSAGES);
            } catch (error){
              console.log(error);
              failed++;
              numberExists = false;
            }
            break;
        }
      }
    }
    success++;
    sleep(DELAY_BETWEEN_PHONES);
    // show progress every 10 records
    if (i % 10 == 0) {
      let progress = parseInt(i/total * 100);
      console.log(`Progress: ${progress}%`);
    }
  }
  let end = Date.now();
  let duration = parseInt((end - start)/1000);
  let sender = client.session + "@c.us";

  console.log(`Done sending. total sent ${i} contacts, success: ${success}, failed: ${failed}, total duration: ${duration}s`);
  await client.sendText(sender, `Done sending. total sent ${i} contacts, success: ${success}, failed: ${failed}, total duration: ${duration}s`);
  client.close();
  // write wa status is done
  // fs.writeFileSync(path.resolve(__dirname) + '/wa.status', "0");
}

function cleanPhone(str) {
  if(typeof str === "number") { //replace method only works with string
    str = String(str);
  }
  return str.replace(/\D/g, "").replace(/^[0]{1}/ ,"62").replace(/^[8]{1}/ ,"628");
}

function getTime() {
  let today = new Date();
  return ("0" + today.getHours()).slice(-2) + ":" + ("0" + today.getMinutes()).slice(-2) + ":" + ("0"+today.getSeconds()).slice(-2);
}

function sleep(milliseconds) {
  const date = Date.now();
  let currentDate = null;
  do {
    currentDate = Date.now();
  } while (currentDate - date < milliseconds);
}

module.exports = apiWA;
