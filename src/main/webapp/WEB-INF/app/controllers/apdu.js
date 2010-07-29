load("WEB-INF/app/models/action.js");

CONTROLLERS.apdu = {
    post: function (req, res) {
        var data = JSON.parse(req.getInputStream());
        var actions = MODELS.action.getActions(req.session.id, data)
        res.setContentType("application/json");
        res.getWriter().write(JSON.stringify(actions));
    },
};
