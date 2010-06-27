var server = new org.mortbay.jetty.Server();
var connector=new org.mortbay.jetty.nio.SelectChannelConnector();
connector.setPort(8080);
server.setConnectors([connector]);
webapp = new org.mortbay.jetty.webapp.WebAppContext();
webapp.setContextPath("/");
webapp.setWar("./src/main/webapp");
var classLoader = new org.mortbay.jetty.webapp.WebAppClassLoader(webapp);
classLoader.addClassPath("target/classes");
classLoader.addJars(org.mortbay.resource.Resource.newResource("lib"));
webapp.setClassLoader(classLoader)
print(webapp.getClassLoader());
server.setHandler(webapp);
server.start();
server.join();