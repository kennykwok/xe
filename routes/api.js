var express = require('express');
var router = express.Router();

const apiRates = require("../lib/rates.js");

router.param("name", function(req, res, next, value) {
console.log("ValiDate");
	const is_valid = value === "symbols" ||
		apiRates.checkDate(value);

	next(is_valid ? null :
		Error("You have entered an invalid date. [Required format: date=YYYY-MM-DD]"));
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
		return next(Error(err));
	}

	if (sym) {
		return apiRates.ratesByDate("symbols")
		.then(function(data) {
			if (!sym.split(",")
				.every((s) => data["symbols"][s])) {
				next(Error("Invalid symbols"));
			}
			next();
		}, function(err) {
			// TODO: Any more info?
			next(Error((err && err.message) || "Internal Error"));
		});
	}

	next();
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

		return res.json(data);
	}, (err) => {
		// TODO: Any more info?
		next(Error((err && err.message) || "Internal Error"));
	});
});

router.get("/convert", function(req, res, next) {

	const from = req.query.from || "EUR";
	const to = req.query.to;
	const amount = +req.query.amount;

	if (from !== "EUR") {
		return next(Error("Invalid from (Support is limited to EUR)"));
	}

	apiRates.ratesByDate("symbols")
	.then(function(data) {
		next(data["symbols"][to] ? null :
			Error("Invalid to"));
	}, function(err) {
		// TODO: Any more info?
		next(Error((err && err.message) || "Internal Error"));
	});
}, function(req, res, next) {
	const date = req.query.date;

	next(!date || apiRates.checkDate(date) ? null :
		Error("Invalid date"));
}, function(req, res, next) {

	const from = req.query.from || "EUR";
	const to = req.query.to;
	const amount = +req.query.amount;
	const date = req.query.date || "latest";

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
		res.json(o);
	}, function(err) {
		next(Error((err && err.message) || "Internal Error"));
	});
});

router.get("/:name", function(req, res, next) {
	const	name = req.params.name;

	apiRates.ratesByDate(name)
	.then(function(data) {
		res.json(data);
	}, (err) => {
		next(Error((err && err.message) || "Internal Error"));
	});
});

router.get("*", function(req, res, next) {
	return res.status(404).json({
		"error": {
			"code": "invalid_api"
		}
	});
});

router.use(function(err, req, res, next) {
	res
	.status(err.status || 505)
	.json({
		"error": {
			"code": err.code || "api_error",
			"message": err.message || ""
		}
	});
});

module.exports = router;
