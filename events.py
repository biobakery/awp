import time
from collections import namedtuple

from util import SerializableMixin

Event = namedtuple("Event", "type time data")

init = lambda data: Event("init", time.time(), data)
skip = lambda data: Event("skip", time.time(), data)
fail = lambda data: Event("fail", time.time(), data)
finish = lambda data: Event("finish", time.time(), data)
execute = lambda data: Event("execute", time.time(), data)
success = lambda data: Event("success", time.time(), data)
