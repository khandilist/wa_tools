const Promise = require('bluebird');
const connection = require("./db_config");

var queryAsync = Promise.promisify(connection.query.bind(connection));
connection.connect();

readBlacklist();

function addRecord() {
	for(let i = 1; i < 2; i++) {
		let number = '08123123123' + pad(i, 2);
		let sql = `INSERT INTO wa_blast_record (sender, receiver, message, status)
	       VALUES ('08222222222', `+number+`, 'This is blast message from linux', 1)`;

		queryAsync(sql).then(function(results) {
			console.log("1 record inserted");
		});
	}
}

function readBlacklist() {
  let whereQuery = 'WHERE status = 1 LIMIT 10';
  queryAsync('SELECT phone, role, resi, product FROM wa_blast_blacklist ' + whereQuery)
  .then(function(results) {
    let phone_list = {};
    results.forEach(function(item, index){ 
      phone_list[item.phone] = {'role': item.role, 'resi': item.resi, 'product': item.product};
    });
    console.log(phone_list);
    if ('6285100394565' in phone_list) {
        console.log('exists');
    } else {
    	console.log('not exists');
    }
  });
}

function addBlacklist() {
	let ll = [['Marvels Kitchen', '6281367533692', 'No-No-Pengirim-old'], ['Nurul Aulia', '6281271644580', 'Yes-No-Penerima-new']]
	for(let i = 0; i < ll.length; i++) {
		let name = ll[i][0];
		let phone = ll[i][1];
		let reason = ll[i][2];
		let start_time = new Date();
		var start_time_fm = (new Date ((new Date((new Date(start_time)).toISOString() )).getTime() - ((start_time).getTimezoneOffset()*60000))).toISOString().slice(0, 19).replace('T', ' ');
		let sql = `INSERT INTO wa_blast_blacklist (phone, name, reason, status, update_time)
	       VALUES ('`+phone+`', '`+name+`', '`+reason+`', 1, '`+start_time_fm+`')`;

		queryAsync(sql).then(function(results) {
			console.log("1 record inserted");
		});
	}
}

function pad(num, size) {
	num = num.toString();
	while (num.length < size) num = "0" + num;
	return num;
}
