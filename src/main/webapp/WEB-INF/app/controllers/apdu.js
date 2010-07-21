load("lib/action.js");

CONTROLLERS.apdu = {
    post: function (req, res) {
        var data = readjson(req);
        var actions = LIB.action.getActions(req.getSession().getId(), data)
        writejson(res, actions);
    },
};
