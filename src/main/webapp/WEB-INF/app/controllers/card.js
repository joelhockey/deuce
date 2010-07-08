CONTROLLERS.card = {
    info: function (req, res) {
        var conn = DATASOURCE.getConnection();
        try {
            stmt = conn.prepareStatement("select * from user");
            stmt.execute();
        } finally {
            conn.close();
        }
    
        jst();
    },
};