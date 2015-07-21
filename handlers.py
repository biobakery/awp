import logging

log = logging.getLogger(__name__)

import tornado
from tornado.options import options
from tornado.websocket import WebSocketHandler

import events
from util import serialize, deserialize
from models import CacheMember

class status:
    SKIP = "skip"
    DONE = "done"
    FAIL = "fail"
    WAIT = "wait"


class MainHandler(tornado.web.RequestHandler):
    def initialize(self, cache):
        self.cache = cache
        self.project = None


    def get(self):
        self.write(serialize({"projects": self.cache.keys()}))
        

class ProjectValidatorMixin(object):
    def validate_project(self, project, do_deserialize=True):
        if project not in self.cache:
            raise tornado.web.HTTPError(
                404, "Project `{}' not found".format(project))
        if do_deserialize:
            return deserialize(self.request.body)



class StatusHandler(MainHandler, ProjectValidatorMixin):
    def get(self, project):
        self.validate_project(project, do_deserialize=False)
        self.write(serialize({
            "tree": self.cache[project].tree.nodes(data=True),
            "events": list(self.cache[project].events),
            "n_subscribers": len(self.cache[project].events.callbacks),
        }))



class SocketHandler(WebSocketHandler, ProjectValidatorMixin):
    def initialize(self, cache):
        self.cache  = cache
        self.project = None


    def check_origin(self, origin):
        return True

    def open(self, project):
        self.validate_project(project, do_deserialize=False)
        self.project = project
        
        def _push(event):
            self.write_message(serialize([event]))
            log.debug("pushed message: %s", event)

        self.cache[project].events.subscribe(id(self.request), _push)
        log.debug("Request id %s subscribed to project %s",
                  id(self.request), project)


    def on_message(self, msg):
        pass


    def on_connection_close(self):
        if self.project:
            self.cache[self.project].events.unsubscribe(id(self.request))
            log.debug("Unsubscribed id %s from project %s events",
                      id(self.request), self.project)
            self.project = None



class InitHandler(StatusHandler):
    def post(self, project):
        nodes = deserialize(self.request.body)
        names = [ {"name": n['name']} for n in nodes ]
        if self.project in self.cache:
            self.cache[project].update_tree(nodes)
        else:
            self.cache[project] = CacheMember.from_init_event(
                nodes, maxlen=options.bufferlen)
        self.cache[project].events.append(events.init(names))


class SkipHandler(StatusHandler):
    def post(self, project):
        data = self.validate_project(project)
        self.cache[project].events.append(events.skip(data))
        name = data['name']
        self.cache[project].tree.node[name]['status'] = status.SKIP


class FailHandler(StatusHandler):
    def post(self, project):
        data = self.validate_project(project)
        self.cache[project].events.append(events.fail(data))
        name = data['name']
        self.cache[project].tree.node[name]['status'] = status.FAIL


class FinishHandler(StatusHandler):
    def post(self, project):
        data = self.validate_project(project)
        self.cache[project].events.append(events.finish(data))


class ExecuteHandler(StatusHandler):
    def post(self, project):
        data = self.validate_project(project)
        self.cache[project].events.append(events.execute(data))
        name = data['name']
        self.cache[project].tree.node[name]['status'] = status.WAIT


class SuccessHandler(StatusHandler):
    def post(self, project):
        data = self.validate_project(project)
        self.cache[project].events.append(events.success(data))
        name = data['name']
        self.cache[project].tree.node[name]['status'] = status.DONE

