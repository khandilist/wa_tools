// import { create, Client } from '@open-wa/wa-automate';

const yargs = require('yargs');
const wa = require('@open-wa/wa-automate');
const csv = require('csv-parser');
const fs = require('fs');
const Promise = require('bluebird');
const connection = require("./db_config");
const prompt = require('prompt-sync')();

// constants config file
const CATEGORY_DICT = require('./constants').BLAST_CATEGORY_DICT;
const CATEGORY_INDEX_LIST = Object.keys(CATEGORY_DICT).map(elem => (parseInt(elem)));

//hendry config
const DELAY_BETWEEN_MESSAGES = 500;
const DELAY_BETWEEN_PHONES = 1000;
const DELAY_BETWEEN_IMAGE = 500;

const LOGFILE = "./logs/" + new Date().toISOString(). replace(/\T.+/, '') + "_LOG.txt";

const argv = yargs
  .option("license", {
    alias: 'l',      
    describe: "License subscription 200rb / month for sending message to unknown contacts",
    type: "string",
  })
	.option("csv", {
		alias: 'c',      
		describe: "The file csv to be used as data for broadcast.",
		type: "string",
	})
	.option("session", {
		alias: 's',      
		describe: "The session file to which Whatsapp account belong to",
		type: "string",
	})    
	.help()
	.alias('help', 'h')
	.argv;

const WA_SESSION = (argv.session) ? argv.session : "";
const WA_LICENSE_KEY = (argv.license) ? fs.readFileSync(argv.license, "utf-8") : "";

const datafile = [];
let phone_blacklist = {};
let category = 0;

start();

function start() {
  let message_list = ['Select blast category:'];
  for (var key in CATEGORY_DICT){
    message_list.push('(' + key + ') ' + CATEGORY_DICT[key]);
  }
  let prompt_message = message_list.join('\n');
  console.log(prompt_message);
  category = parseInt(prompt('Input: '));
  if (CATEGORY_INDEX_LIST.includes(category)) {
    // select all blacklist phone
    let whereQuery = 'WHERE status = 1';
    queryAsync('SELECT phone, role, resi, product FROM wa_blast_blacklist ' + whereQuery)
    .then(function(results) {
      results.forEach(function(item, index){
        phone_blacklist[item.phone] = {'role': item.role, 'resi': item.resi, 'product': item.product};
      });
      handleCSVFile();
      start_wa();
    });
  } else {
    console.log("Please input valid option");
  }
}

function handleCSVFile() {
  if (argv.csv) {
    console.log(`argv.csv : is ${argv.csv}`);
    fs.createReadStream(argv.csv)
    .pipe(csv())
    .on('data', (row) => {
      row['phone'] = cleanPhone(row['phone']);
      datafile.push(row);
    })
    .on('end', () => {
      console.log(`CSV file successfully processed, total entries : ${datafile.length}`);
    });
  }
}

function start_wa() {
//console.log(`using license ${WA_LICENSE}`);
  wa.create({
    licenseKey: WA_LICENSE_KEY,
    useChrome: false,
    headless: false,
    logFile: true,
    //sessionId: "SESSION",
    multiDevice: true,
    authTimeout: 600, //wait only 60 seconds to get a connection with the host account device
    // blockCrashLogs: true,
    disableSpins: false,
    resizable: true,
    waitForRipeSession:true, //hendry try for first messages error (session / license not ready yet )
    sessionDataPath: WA_SESSION,
    onError: "RETURN_ERROR",
    // hostNotificationLang: 'PT_BR',
    // logConsole: true,
    // popup: true,
    viewport:{
      height: 800,
      width: 800
    },
    //customUserAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36',
    qrTimeout: 0 //0 means it will wait forever for you to scan the qr code
  }).then(client => do_WA_sent_messages(client));
}

async function do_WA_sent_messages(client) {
  // log start and end time to calculate consumed time
  let start_time = new Date();
  let sender = await client.getHostNumber();

  let messages = [
    {
      columnName: 'message1', type: 'string',
    },
    {
      columnName: 'message2', type: 'string',
    }, 
    {
      columnName: 'message3', type: 'string',
    },
    {
      columnName: 'resi1', type: 'string',
    },
    {
      columnName: 'product1', type: 'string',
    },
    {
      columnName: 'product2', type: 'string',
    },
    {
      columnName: 'pic1', type: 'image',
    },
    {
      columnName: 'pic2', type: 'image',
    },
    {
      columnName: 'pic3', type: 'image',
    },
    {
      columnName: 'pic_product1', type: 'image',
    }
  ];

  let i = 0;
  let query_data = [];
  // calculate send status
  let success_phone_list = [];
  let failed_phone_list = [];
  let blocked_phone_list = [];
  let success_message = 0;
  let failed_message = 0;
  for (i = 0; i < datafile.length; i++) {
    //phoneStr = "628118255303@c.us";
    //console.log(today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds());
 
    let phoneStr = datafile[i]['phone'] + "@c.us";
    let is_blacklist = datafile[i]['phone'] in phone_blacklist;

    //PATCH, skip if messages and pics are all empty
    //we emptied messages and pics in list if we want to continue broadcast, maybe previous list was interrupted
    let hasContent = false;
    for(let j = 0; j < messages.length; j++) {
      if(datafile[i][messages[j].columnName]) {
        hasContent = true;
        break;
      }
    }

    if(!hasContent) //skip this entry
      continue;

    console.log( datafile[i]['phone'] + " sending... " + getTime() );

    for(let m = 0; m < messages.length; m++) {
      if(datafile[i][messages[m].columnName]) {
        // check either phone is blacklisted, skip if it is match some cases
        if (is_blacklist) {
          let skip_message = undefined;
          if (['resi1'].includes(messages[m].columnName) && phone_blacklist[datafile[i]['phone']].resi) {
            skip_message = 'Skip Resi';
          } else if (['product1', 'product2', 'pic_product1'].includes(messages[m].columnName) && phone_blacklist[datafile[i]['phone']].product) {
            skip_message = 'Skip Product';
          }
          if (skip_message) {
            query_data.push({'sender': sender, 'receiver': phoneStr, 'message': datafile[i][messages[m].columnName], 'error': skip_message, 'status': 3});
            if (!blocked_phone_list.includes(phoneStr)) {
              blocked_phone_list.push(phoneStr);
            }
            failed_message++;
            continue;
          }
        }

        let send_status = 0;
        let error_message = '';
        let data = {}
        let sql;

        switch(messages[m].type) {
          case 'string':
            try {
              let debug = await client.sendText(phoneStr, datafile[i][messages[m].columnName]); 
              if(typeof(debug) == "string" && debug.includes('true')) {
                send_status = 1;
              } else {
                fs.appendFileSync(LOGFILE, sender + ",error," + phoneStr + "\n");
                send_status = 0;
              }

              sleep(DELAY_BETWEEN_MESSAGES);
            } catch (error){
              console.log("Err = ", error);
              error_message = error;
              send_status = 0;
            }
            //console.log(`sending text ${datafile[i][messages[m].columnName]}`);
            break;
          case 'image':
            try {
              let debug = await client.sendImage(phoneStr, datafile[i][messages[m].columnName]);
              if(debug) {
                send_status = 1;
              } else {
                fs.appendFileSync(LOGFILE, sender + ",error," + phoneStr + "\n");
                send_status = 0;
              }

              sleep(DELAY_BETWEEN_IMAGE);
            } catch (error){
              console.log("Err = ", error);
              error_message = error;
              send_status = 0;
            }
            //console.log(`sending image ${datafile[i][messages[m].columnName]}`);
            break;
        }

        // set data needed to be saved to database
        if (send_status) {
          success_message++;
          if (!success_phone_list.includes(phoneStr)) {
            success_phone_list.push(phoneStr);
          }
        } else {
          failed_message++;
          if (!failed_phone_list.includes(phoneStr)) {
            failed_phone_list.push(phoneStr);
          }
        }
        query_data.push({'sender': sender, 'receiver': phoneStr, 'message': datafile[i][messages[m].columnName], 'error': error_message, 'status': send_status});
      }
    }
    sleep(DELAY_BETWEEN_PHONES);
  }

  let end_time = new Date();
  var start_time_fm = (new Date ((new Date((new Date(start_time)).toISOString() )).getTime() - ((start_time).getTimezoneOffset()*60000))).toISOString().slice(0, 19).replace('T', ' ');
  var end_time_fm = (new Date ((new Date((new Date(end_time)).toISOString() )).getTime() - ((end_time).getTimezoneOffset()*60000))).toISOString().slice(0, 19).replace('T', ' ');
  // let start_time_fm = start_time.toISOString().slice(0, 19).replace('T', ' ');
  // let end_time_fm = end_time.toISOString().slice(0, 19).replace('T', ' ');
  let time_consumed = Math.abs(start_time.getTime() - end_time.getTime());

  let success = success_phone_list.length;
  let failed = failed_phone_list.length;
  let blocked = blocked_phone_list.length;
  let message_avg = (success_message+failed_message)/(success+failed);

  // create db connection and bulk insert to db
  var queryAsync = Promise.promisify(connection.query.bind(connection));
  connection.connect();
  // insert summary then get the summary_id
  let summary_sql = `INSERT INTO wa_blast_summary SET ?`;
  let summary_values = {'category': category, 'phone': sender, 'start': start_time_fm, 'end': end_time_fm, 'total_time': time_consumed, 'success': success, 'failed': failed, 'blocked': blocked, 'success_message': success_message, 'failed_message': failed_message, 'message_avg': message_avg};
  let res = await queryAsync(summary_sql, summary_values);
  let summary_id = res.insertId;

  let sql = `INSERT INTO wa_blast_record (summary_id, sender, receiver, message, error, status) VALUES ?`;
  const sql_data = [query_data.map(item => [summary_id, item.sender, item.receiver, item.message, item.error, item.status])];
  await queryAsync(sql, sql_data);

  console.log(`done sending. total sent ${i} contacts`);
  console.log(`Press ctrl + c to exit`);
}

function getTime() {
  let today = new Date();
  //return format HH:MM:SS
  return ("0" + today.getHours()).slice(-2) + ":" + ("0" + today.getMinutes()).slice(-2) + ":" + ("0"+today.getSeconds()).slice(-2);
}

function cleanPhone(str) {
  if(typeof str === "number") { //replace method only works with string
    str = String(str);
  }
  return str.replace(/\D/g, "").replace(/^[0]{1}/ ,"62").replace(/^[8]{1}/ ,"628");
}
  
function sleep(milliseconds) {
  const date = Date.now();
  let currentDate = null;
  do {
    currentDate = Date.now();
  } while (currentDate - date < milliseconds);
}
