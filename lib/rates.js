const axios = require("axios");
const fs = require("fs");
const moment = require('moment');

const key = "d5b3461079a1830e5be8975f5c9ac877";

const date_fmt = "YYYY-MM-DD";

const makeDate = (date) =>
	moment.utc(date, date_fmt, true);

const checkDate = (date) => {
	let v = makeDate(date);

	return v.isValid() && v.isBefore(moment.utc());
};

const isToday = (date) =>
	makeDate(date)
	.isSame(moment.utc(), "day");

const yesterday = (date) =>
	makeDate(date)
	.subtract(1, "day")
	.format(date_fmt);

const diffDate = (start_date, end_date) =>
	makeDate(end_date)
	.diff(makeDate(start_date), "days");

const arrayDate = (start_date, end_date) => {

	let m = makeDate(start_date);
	let arr = [];
	let v;

	do {
		arr.push(v = m.format(date_fmt));
		m.add(1, "day");
	} while (v !== end_date);

	return arr;
}

const cachedRatesByDate = (date) =>
	new Promise((resolve, reject) => {
		const   cache = "cache/" + date + ".json";

		if (isToday(date)) {
			return reject();
		}
		fs.access(cache, function(err) {
			if (err) {
				return reject();
			}
			fs.readFile(cache, (err, data) => {
				if (err) {
					return reject();
				}
				try {
					let json = JSON.parse(data);
					resolve(json)
				} catch(e) {
					reject();
				}
			});
		});
	});

const ratesByDate = (date) => {
	const	cache = "cache/" + date + ".json";
	const	url = "http://api.exchangeratesapi.io/v1/" +
			date + "?access_key=" + key;

	return cachedRatesByDate(date)
	.catch(() =>
		axios.get(url)
		.then(function(response) {
			var	data = response.data;

			if (data &&
				data["success"] &&
				(data["symbols"] ||
				data["historical"]) &&
				!isToday(data["date"])) {
				fs.writeFile(cache, JSON.stringify(data), "utf8",
					()=>{});
				data["life"] = true;
			}
			return data;
		})
	);
};

module.exports = {
	checkDate: checkDate,
	diffDate: diffDate,
	arrayDate: arrayDate,
	isToday: isToday,
	yesterday: yesterday,
	ratesByDate: ratesByDate
};
