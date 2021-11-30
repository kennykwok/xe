var express = require('express');
var router = express.Router();

const axios = require('axios');
const fs = require('fs');

const apiRates = require("../lib/rates.js");

const key = "d5b3461079a1830e5be8975f5c9ac877";


router.param("name", function(req, res, next, value) {
console.log("ValiDate");
	const is_valid = value === "symbols" ||
		apiRates.checkDate(value);

	if (!is_valid) {
		var o = {
			"error": {
				"code": "invalid_date",
				"message": "You have entered an invalid date. [Required format: date=YYYY-MM-DD]"
			}
		};
		res.send(o);
	} else {
		next();
	}
});

router.get("/fluctuation", function(req, res, next) {
	const limit = 31;	// Limit the scope be within 31 days
	const st = req.query.start_date;
	const ed = req.query.end_date;
	const sym = req.query.symbols;
	let err;

	if (!apiRates.checkDate(st)) {
		err = "Invalid start_date";
	} else if (!apiRates.checkDate(ed)) {
		err = "Invalid end_date";
	} else {
		let d = apiRates.diffDate(st, ed);
		if (!(d >= 0)) {
			err = "Invalid range between start_date and end_date";
		} else if (d >= limit) {
			err = "Range between start_date and end_date must be within " + limit + " days";
		}
	}

	if (err) {
		return res
		.status(400)
		.send(err);
	}

	if (sym) {
		apiRates.ratesByDate("symbols")
		.then(function(data) {
			if (!sym.split(",")
				.every((s) => data["symbols"][s])) {
				return Promise.reject();
			}
			next();
		}, () => Promise.reject()
		)
		.catch(function(err) {
			o = {
				"error": {
					"message": "Invalid symbols"
				}
			};
			return res
			.status(400)
			.send(o);
		});
	} else {
		next();
	}
}, function(req, res, next) {
	const st = req.query.start_date;
	const ed = req.query.end_date;
	const range = apiRates.arrayDate(
		apiRates.yesterday(st), ed);
	const promises = range.map(date => apiRates.ratesByDate(date));
	const sym_str = req.query.symbols;
	const sym = sym_str && sym_str.length ?
		sym_str.split(",") : null;

	Promise.all(promises)
	.then((values) => {
		let prev = values.shift();
		let data = values.map((o) => {
			let v = {
				date: o["date"],
				rates: {}
			};

			(sym || Object.keys(o["rates"]))
			.forEach((type) => {
				const n = o["rates"][type];
				const pn = prev["rates"][type];

				if (n > 0.0 && pn > 0.0) {
					v["rates"][type] = {
						"rate": n,
						"change": +((n - pn).toFixed(6)),
						"change_pct": +(((n - pn)/pn).toFixed(6))*100
					};
				}
			});
			prev = o;
			return v;
		});

		return res.send(data);
	}, (err) => {
		res
		.status(400)
		.send(err);
	});
});

router.get("/convert", function(req, res, next) {

	const from = req.query.from || "EUR";
	const to = req.query.to;
	const amount = +req.query.amount;

	if (from !== "EUR") {
		o = {
			"error": {
				"message": "Invalid from (Support is limited to EUR)"
			}
		};
		return res
		.status(400)
		.send(o);
	}

	apiRates.ratesByDate("symbols")
	.then(function(data) {
		if (data["symbols"][to]) {
			next();
		} else {
			return Promise.reject("Invalid to");
		}
	})
	.catch(function(err) {
		o = {
			"error": {
				"message": "Invalid to"
			}
		};
		return res
		.status(400)
		.send(o);
	});
}, function(req, res, next) {
	const date = req.query.date;

	if (date &&
		!apiRates.checkDate(date)) {
		o = {
			"error": {
				"message": "Invalid date"
			}
		};
		return res
		.status(400)
		.send(o);
	}
	next();
}, function(req, res, next) {

	const from = req.query.from || "EUR";
	const to = req.query.to;
	const amount = +req.query.amount;
	const date = req.query.date || "2021-11-22";	// For development, use a fixed single date rate.

	apiRates.ratesByDate(date)
	.then(function(data) {
		const result = +((amount * data["rates"][to]).toFixed(6));
		let o = {
			success: true,
			query: req.query,
			info: {
				timestamp: data["timestamp"],
				rate: data["rates"][to]
			},
			result: result
		};
		if (data["historial"]) {
			o["historial"] = data["historial"];
			o["date"] = data["date"];
		}
		res.send(o);
		return;
	}, function(err) {
		return res
		.status(400)
		.send("Failure to convert");
	});
});

router.get("/:name", function(req, res, next) {
	const	name = req.params.name;

	apiRates.ratesByDate(name)
	.then(function(data) {
		res.setHeader('Content-Type', 'application/json');
		res.send(data);
	});
});

router.get("/", function(req, res, next) {
	var	o = {
			"error": {
				"code": "invalid_api"
			}
		};

	res.send(o);
});

module.exports = router;
