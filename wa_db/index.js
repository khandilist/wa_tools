const express = require('express');
const path = require('path');
const Promise = require('bluebird');
const bodyParser = require('body-parser');
const json2csv = require('json2csv').Parser;
const connection = require('./db_config');
const moment = require('moment');
const app = express();

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

var queryAsync = Promise.promisify(connection.query.bind(connection));
connection.connect();

process.stdin.resume()
process.on('exit', exitHandler.bind(null, { shutdownDb: true } ));

app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', function (req, res) {
  var numRows;
  var queryPagination;
  var numPerPage = parseInt(req.query.npp, 10) || 1;
  var page = parseInt(req.query.page, 10) || 0;
  var numPages;
  var skip = page * numPerPage;
  // Here we compute the LIMIT parameter for MySQL query
  var limit = skip + ',' + numPerPage;
  queryAsync('SELECT count(*) as numRows FROM wa_blast_record')
  .then(function(results) {
    numRows = results[0].numRows;
    numPages = Math.ceil(numRows / numPerPage);
    console.log('number of pages:', numPages);
  })
  .then(() => queryAsync('SELECT * FROM wa_blast_record ORDER BY ID DESC LIMIT ' + limit))
  .then(function(results) {
    var responsePayload = {
      results: results
    };
    if (page < numPages) {
      responsePayload.pagination = {
        current: page,
        perPage: numPerPage,
        previous: page > 0 ? page - 1 : undefined,
        next: page < numPages - 1 ? page + 1 : undefined
      }
    }
    else responsePayload.pagination = {
      err: 'queried page ' + page + ' is >= to maximum page number ' + numPages
    }
    res.json(responsePayload);
  })
  .catch(function(err) {
    console.error(err);
    res.json({ err: err });
  });
});

app.get('/records', (req, res) => {
  var numRows;
  var queryPagination;
  var numPerPage = parseInt(req.query.npp, 10) || 50;
  var page = parseInt(req.query.page, 10) || 0;
  var numPages;
  var skip = page * numPerPage;
  var status = parseInt(req.query.status, 10) || 0;
  var sdate = req.query.sdate;
  var edate = req.query.edate;
  var phone = req.query.phone;
  var summary_id = req.query.summary_id;
  var whereQuery = 'WHERE 1';
  if (sdate) {
    whereQuery = 'WHERE create_time >= ' + "'" + sdate + "'" + ' AND create_time <= ' + 'DATE_ADD("'+edate+'", INTERVAL +1 DAY)';
  }
  if (status == 1) {
    whereQuery += ' AND status = 1';
  }
  if (status == 2) {
    whereQuery += ' AND status = 0';
  }
  if (summary_id) {
    whereQuery += ' AND summary_id = ' + summary_id;
  }
  if (phone) {
    whereQuery += ' AND receiver like "' + phone + '%"';
  }
  // Here we compute the LIMIT parameter for MySQL query
  var limit = connection.escape(skip) + ',' + connection.escape(numPerPage);
  queryAsync('SELECT count(*) as numRows FROM wa_blast_record ' + whereQuery)
  .then(function(results) {
    numRows = results[0].numRows;
    numPages = Math.ceil(numRows / numPerPage);
    console.log('number of pages:', numPages);
  })
  .then(() => queryAsync('SELECT * FROM wa_blast_record ' + whereQuery + ' ORDER BY ID DESC LIMIT ' + limit))
  .then(function(results) {
    let pagination = {};
    if (page < numPages) {
      pagination = {
        current: page,
        perPage: numPerPage,
	numPages: numPages,
        previous: page > 0 ? page - 1 : undefined,
        next: page < numPages - 1 ? page + 1 : undefined
      }
    } else {
      let err = 'queried page ' + page + ' is >= to maximum page number ' + numPages
      res.json({ err: err });
    }
    res.render('list_records', {
      title: 'Blast Records',
      sdate: sdate,
      edate: edate,
      phone: phone,
      summary_id: summary_id,
      status: status,
      records: results,
      pagination: pagination,
      moment: moment,
    });
  })
  .catch(function(err) {
    console.error(err);
    res.json({ err: err });
  });
});

app.get('/blacklist/add', (req, res) => {
  res.render('blacklist_add', {
    title: 'Add Phone to WA Blacklist',
    moment: moment,
  });
});

app.post('/blacklist/add', (req, res) => {
  var name = req.body.name;
  var phone = req.body.phone;
  var reason = req.body.reason;
  var role = req.body.role;
  var skip_resi = req.body.skip_resi;
  var skip_product = req.body.skip_product;
  var whereQuery = 'WHERE phone = "' + phone + '"';
  queryAsync('SELECT count(*) as numRows FROM wa_blast_blacklist ' + whereQuery)
  .then(function(results) {
    let num = results[0].numRows;
    let invalid_phone = num > 0;
    if (invalid_phone) {
      res.render('blacklist_add', {
        title: 'Add Phone to WA Blacklist',
        moment: moment,
        invalid_phone: true,
        name: name,
        phone: phone,
        role: role,
        skip_resi: skip_resi,
        skip_product: skip_product,
        reason: reason,
      });
    } else {
      let update_time = new Date();
      var update_time_fm = (new Date ((new Date((new Date(update_time)).toISOString() )).getTime() - ((update_time).getTimezoneOffset()*60000))).toISOString().slice(0, 19).replace('T', ' ');
      let insert_sql = `INSERT INTO wa_blast_blacklist SET ?`;
      let insert_values = {'phone': phone, 'name': name, 'reason': reason, 'status': 1, 'update_time': update_time_fm};
      if (skip_resi) {
        insert_values['resi'] = 1;
      }
      if (skip_product) {
        insert_values['product'] = 1;
      }
      queryAsync(insert_sql, insert_values)
      .then(function(results) {
        res.redirect('/blacklist/');
      });
    }
  })
  .catch(function(err) {
    console.error(err);
    res.json({ err: err });
  });
});

app.get('/blacklist', (req, res) => {
  var numRows;
  var queryPagination;
  var numPerPage = parseInt(req.query.npp, 10) || 50;
  var page = parseInt(req.query.page, 10) || 0;
  var numPages;
  var skip = page * numPerPage;
  var sdate = req.query.sdate;
  var edate = req.query.edate;
  var whereQuery = 'WHERE 1';
  if (sdate) {
    whereQuery = 'WHERE create_time >= ' + "'" + sdate + "'" + ' AND create_time <= ' + 'DATE_ADD("'+edate+'", INTERVAL +1 DAY)';
  }
  // Here we compute the LIMIT parameter for MySQL query
  var limit = connection.escape(skip) + ',' + connection.escape(numPerPage);
  queryAsync('SELECT count(*) as numRows FROM wa_blast_blacklist ' + whereQuery)
  .then(function(results) {
    numRows = results[0].numRows;
    numPages = Math.ceil(numRows / numPerPage);
    console.log('number of pages:', numPages);
  })
  .then(() => queryAsync('SELECT * FROM wa_blast_blacklist ' + whereQuery + ' ORDER BY ID DESC LIMIT ' + limit))
  .then(function(results) {
    let pagination = {};
    if (page < numPages) {
      pagination = {
        current: page,
        perPage: numPerPage,
	numPages: numPages,
        previous: page > 0 ? page - 1 : undefined,
        next: page < numPages - 1 ? page + 1 : undefined
      }
    } else {
      let err = 'queried page ' + page + ' is >= to maximum page number ' + numPages
      res.json({ err: err });
    }
    res.render('list_blacklist', {
      title: 'Blacklist Phone',
      sdate: sdate,
      edate: edate,
      records: results,
      pagination: pagination,
      moment: moment,
    });
  })
  .catch(function(err) {
    console.error(err);
    res.json({ err: err });
  });
});

app.get('/summary', (req, res) => {
  var numRows;
  var queryPagination;
  var numPerPage = parseInt(req.query.npp, 10) || 50;
  var page = parseInt(req.query.page, 10) || 0;
  var numPages;
  var skip = page * numPerPage;
  var sdate = req.query.sdate;
  var edate = req.query.edate;
  var category = req.query.category;
  var phone = req.query.phone;
  var whereQuery = 'WHERE 1';
  if (sdate) {
    whereQuery = 'WHERE start >= ' + "'" + sdate + "'" + ' AND start <= ' + 'DATE_ADD("'+edate+'", INTERVAL +1 DAY)';
  }
  if (category) {
    whereQuery += ' AND category = ' + category;
  }
  if (phone) {
    whereQuery += ' AND phone = ' + phone;
  }
  // Here we compute the LIMIT parameter for MySQL query
  var limit = connection.escape(skip) + ',' + connection.escape(numPerPage);
  queryAsync('SELECT count(*) as numRows FROM wa_blast_summary ' + whereQuery)
  .then(function(results) {
    numRows = results[0].numRows;
    numPages = Math.ceil(numRows / numPerPage);
    console.log('number of pages:', numPages);
  })
  .then(() => queryAsync('SELECT * FROM wa_blast_summary ' + whereQuery + ' ORDER BY ID DESC LIMIT ' + limit))
  .then(function(results) {
    let pagination = {};
    if (page < numPages) {
      pagination = {
        current: page,
        perPage: numPerPage,
	numPages: numPages,
        previous: page > 0 ? page - 1 : undefined,
        next: page < numPages - 1 ? page + 1 : undefined
      }
    } else {
      let err = 'queried page ' + page + ' is >= to maximum page number ' + numPages
      res.json({ err: err });
    }

    const CATEGORY_DICT = require('./constants').BLAST_CATEGORY_DICT;
    res.render('list_summary', {
      title: 'Blast Summary',
      sdate: sdate,
      edate: edate,
      records: results,
      pagination: pagination,
      category_dict: CATEGORY_DICT,
      category: category,
      phone: phone,
      moment: moment,
    });
  })
  .catch(function(err) {
    console.error(err);
    res.json({ err: err });
  });
});

app.get("/downloads", function (req, res) {
  var status = parseInt(req.query.status, 10) || 0;
  var sdate = req.query.sdate;
  var edate = req.query.edate;
  var phone = req.query.phone;
  var summary_id = req.query.summary_id;
  var whereQuery = 'WHERE 1';
  if (sdate) {
    whereQuery = 'WHERE create_time >= ' + "'" + sdate + "'" + ' AND create_time <= ' + 'DATE_ADD("'+edate+'", INTERVAL +1 DAY)';
  }
  if (status == 1) {
    whereQuery += ' AND status = 1';
  }
  if (status == 2) {
    whereQuery += ' AND status = 0';
  }
  if (phone) {
    whereQuery += ' AND receiver like "' + phone + '%"';
  }
  if (summary_id) {
    whereQuery += ' AND summary_id = ' + summary_id;
  }
  // Here we compute the LIMIT parameter for MySQL query
  let data = [];
  queryAsync('SELECT id, sender, receiver, message, status, create_time FROM wa_blast_record ' + whereQuery + ' ORDER BY ID DESC')
  .then(function(results) {
    Object.keys(results).forEach(function(key) {
      var row = results[key];
      var fm_time = moment(row.create_time).format('dddd, MMM D YYYY, HH:mm');
      data.push({'ID': row.id, 'Sender': row.sender, 'Receiver': row.receiver, 'Message': row.message, 'Status': row.status, 'Create Time': fm_time});
    });
    const csvFields = ["ID", "Sender", "Receiver", "Message", "Status", "Create Time"];
    const csvParser = new json2csv({ csvFields });
    const csvData = csvParser.parse(data);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=wa_results.csv");
    res.status(200).end(csvData);
  });
});

app.get("/downloads_summary", function (req, res) {
  var sdate = req.query.sdate;
  var edate = req.query.edate;
  var category = req.query.category;
  var phone = req.query.phone;
  var whereQuery = 'WHERE 1';
  if (sdate) {
    whereQuery = 'WHERE start >= ' + "'" + sdate + "'" + ' AND start <= ' + 'DATE_ADD("'+edate+'", INTERVAL +1 DAY)';
  }
  if (category) {
    whereQuery += ' AND category = ' + category;
  }
  if (phone) {
    whereQuery += ' AND phone = ' + phone;
  }
  const CATEGORY_DICT = require('./constants').BLAST_CATEGORY_DICT;
  // Here we compute the LIMIT parameter for MySQL query
  let data = [];
  queryAsync('SELECT * FROM wa_blast_summary ' + whereQuery + ' ORDER BY ID DESC')
  .then(function(results) {
    Object.keys(results).forEach(function(key) {
      var row = results[key];
      var fm_category = CATEGORY_DICT[row.category];
      var total_time = parseInt(row.total_time / 60000);
      var fm_start = moment(row.start).format('dddd, MMM D YYYY, HH:mm');
      var fm_end = moment(row.end).format('dddd, MMM D YYYY, HH:mm');
      data.push({'ID': row.id, 'Category': fm_category, 'Phone': row.phone, 'Start': fm_start, 'End': fm_end, 'Total Time': total_time, 'Success': row.success, 'Failed': row.failed, 'Blocked': row.blocked, 'Success Message': row.success_message, 'Failed Message': row.failed_message, 'Message Avg': row.message_avg.toFixed(2)});
    });
    const csvFields = ["ID", "Category", "Phone", "Start", "End", "Total Time", "Success", "Failed", "Blocked", "Success Message", "Failed Message", "Message Avg"];
    const csvParser = new json2csv({ csvFields });
    const csvData = csvParser.parse(data);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=wa_summary.csv");
    res.status(200).end(csvData);
  });
});

app.get("/downloads_blacklist", function (req, res) {
  var sdate = req.query.sdate;
  var edate = req.query.edate;
  var whereQuery = 'WHERE 1';
  if (sdate) {
    whereQuery = 'WHERE create_time >= ' + "'" + sdate + "'" + ' AND create_time <= ' + 'DATE_ADD("'+edate+'", INTERVAL +1 DAY)';
  }
  // Here we compute the LIMIT parameter for MySQL query
  let data = [];
  queryAsync('SELECT * FROM wa_blast_blacklist ' + whereQuery + ' ORDER BY ID DESC')
  .then(function(results) {
    Object.keys(results).forEach(function(key) {
      var row = results[key];
      var role = row.role == 1 ? 'Penerima' : 'Pengirim';
      var fm_update_time = moment(row.update_time).format('dddd, MMM D YYYY, HH:mm');
      var fm_create_time = moment(row.create_time).format('dddd, MMM D YYYY, HH:mm');
      data.push({'ID': row.id, 'Phone': row.phone, 'Name': row.name, 'Role': role, 'Skip Resi': row.resi, 'Skip Product': row.product, 'Reason': row.reason, 'Status': row.status, 'Update Time': fm_update_time, 'Create Time': fm_create_time});
    });
    const csvFields = ["ID", "Phone", "Name", "Role", "Skip Resi", "Skip Product", "Reason", "Status", "Update Time", "Create Time"];
    const csvParser = new json2csv({ csvFields });
    const csvData = csvParser.parse(data);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=wa_blacklist.csv");
    res.status(200).end(csvData);
  });
});

app.listen(3000, function () {
  console.log('Start to listening on port 3000!');
});

function exitHandler(options, err) {
  if (options.shutdownDb) {
    console.log('shutdown mysql connection');
    connection.end();
  }
  if (err) console.log(err.stack);
  if (options.exit) process.exit();
}
