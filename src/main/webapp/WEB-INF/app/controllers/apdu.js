load("WEB-INF/lib/action.js");

CONTROLLERS.apdu = {
    post: function (req, res) {
        var data = JSON.parse(req.getInputStream());
        var actions = LIB.action.getActions(req.getSession().getId(), data)
        res.setContentType("application/json");
        res.getWriter().write(JSON.stringify(actions));
    },
};
