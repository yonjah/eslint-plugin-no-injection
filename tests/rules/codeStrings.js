module.exports = {
	unsafe: {
		InsecureExceptionHandler: `
			function InsecureExceptionHandler (msg, url, linenumber) {
				const errorId = randomString(20),
					userAgent = padutils.escapeHtml(navigator.userAgent),
					editor = $("#editorloadingbox");

				let logMsg = "ErrorId: " + errorId + " URL: " + window.location.href + " UserAgent: " + userAgent + " " + msg + " in " + url + " at line " + linenumber ;

				if (editor.attr("display") != "none") {
					editor.html("<b>An error occurred</b> The error was reported with the following id: '" + errorId + "<br/>" + logMsg);
				}

				//send javascript errors to the server
				$.post(url, {errorInfo: JSON.stringify({errorId, logMsg, url: window.location.href, linenumber, userAgent: navigator.userAgent})});

				return false;
			}`,
		InsecureMsgHandler: `
			function InsecureMsgHandler (msg) {
				const errorId = randomString(20),
					editor = $("#editorloadingbox");

				let logMsg = "Error: " + msg + " in " +  " at line ";

				if (editor.attr("display") != "none") {
					editor.html("<b>An error occurred</b> The error was reported with the following id: '" + errorId + "<br/>" + logMsg);
				}

				return false;
			}`,
		InsecureDataHandler: `
			function InsecureDataHandler(data) {
				data = JSON.stringify(data, null, 2);
				var popupHtml = '<pre class="simplepre">' + data + '</pre>';
				popupHtml += '<div class="close-icon useCursorPointer" onClick="closeScreenshot();"></div>';
				$('#screenshot_box').html(popupHtml);
			}`,
		ExpressInsecureRoute: `
			function (req, res) => {
				const { email, password } = req.body;
				User.findOne({ email })
					.then(user => res.send(user));
			}
		`,
		ExpressInsecureMiddleware: `
			function (req, res) => {
				const { token } = req.cookies;
				return Session.findOne({ token, status: 'valid' })
					.then(seesion => {
						req.session = session;
					});
			}
		`
	},
	safe: {
		SecureExceptionHandler: `
			function SecureExceptionHandler (msg, url, linenumber) {
				const errorId = randomString(20),
					userAgent = padutils.escapeHtml(navigator.userAgent),
					editor = $("#editorloadingbox");

				let logMsg = "ErrorId: " + errorId + " URL: " + escapeHTML(window.location.href) + " UserAgent: " + userAgent + " " + msg + " in " + url + " at line " + linenumber ;

				if (editor.attr("display") != "none") {
				editor.html("<b>An error occurred</b> The error was reported with the following id: '" + errorId + "<br/>" + logMsg);
				}

				//send javascript errors to the server
				$.post(url, {errorInfo: JSON.stringify({errorId, logMsg, url: window.location.href, linenumber, userAgent: navigator.userAgent})});

				return false;
			}`,
		SecureDataHandler: `
			function SecureDataHandler(data) {
				data = escapeHTML(JSON.stringify(data, null, 2));
				var popupHtml = '<pre class="simplepre">' + data + '</pre>';
				popupHtml += '<div class="close-icon useCursorPointer" onClick="closeScreenshot();"></div>';
				$('#screenshot_box').html(popupHtml);
			}`

	}

};