import os
import logging

log = logging.getLogger(__name__)

import tornado.web
import tornado.ioloop
import tornado.process
import tornado.options 
from tornado.options import define, options

from handlers import (
    MainHandler,
    InitHandler, 
    SkipHandler, 
    FailHandler, 
    FinishHandler,
    SocketHandler,
    StatusHandler,
    ExecuteHandler, 
    SuccessHandler, 
)

from models import (
    AgeDict
)



define( 'listenport', default=8080, 
        help="HTTP will be served on this port", 
        type=int )
define( 'mounturl', default="/awp/",
        help="Base url to accept requests from",
        type=str)
define( 'bufferlen',  default=1000,  
        help="Number of events to keep in memory", 
        type=int )
define( 'staticprefix', default="", type=str,
        help="Rename static content URLs with this prefix. ")
define( 'static',  default=os.path.join(os.path.dirname(__file__), 'static'),
        help=("Serve these static files."), 
        type=str )
define( 'maxage', default=AgeDict.DEFAULT_TTL, type=int,
        help="Old project expiration time in milliseconds")


def main():
    tornado.options.parse_command_line()
    logging.getLogger().setLevel(getattr(logging, options.logging.upper()))
    
    cache = AgeDict()
    base = options.mounturl
    routes = (
        ( base,                       MainHandler,    {"cache": cache}),
        ( base+r'([\w.]+)/?',         StatusHandler,  {"cache": cache}),
        ( base+r'([\w.]+)/init/?',    InitHandler,    {"cache": cache}),
        ( base+r'([\w.]+)/skip/?',    SkipHandler,    {"cache": cache}),
        ( base+r'([\w.]+)/fail/?',    FailHandler,    {"cache": cache}),
        ( base+r'([\w.]+)/finish/?',  FinishHandler,  {"cache": cache}),
        ( base+r'([\w.]+)/socket/?',  SocketHandler,  {"cache": cache}),
        ( base+r'([\w.]+)/execute/?', ExecuteHandler, {"cache": cache}),
        ( base+r'([\w.]+)/success/?', SuccessHandler, {"cache": cache}),
    )

    app_settings = dict(
        static_path=options.static,
        template_path=os.path.join(os.path.dirname(__file__), 'templates'),
        debug=(options.logging.lower() == 'debug')
        )

    app = tornado.web.Application( routes, **app_settings )
    app.listen(options.listenport)

    ioloop = tornado.ioloop.IOLoop.instance()

    tornado.ioloop.PeriodicCallback(
        lambda *a, **kw: log.debug("Purged %i stale projects",
                                   cache.clean(options.maxage)),
        60*60*1000 # 1 hr in milliseconds
    ).start()

    try:
        ioloop.start()
    except KeyboardInterrupt:
        log.info('Keyboard interrupt. Shutting down...')


if __name__ == "__main__":
    main()
