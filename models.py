import time
from itertools import islice
from collections import deque

import networkx as nx
from networkx.algorithms.dag import topological_sort

import events
from util import SerializableMixin


class EventDeque(deque):
    """EventDeque keeps a running, fixed-length, buffer of everything
    appended to it.  Whenever something calls append(), EventDeque
    calls whatever callbacks added by previous calls to subscribe().

    Use should be something like::

        buf = EventDeque(maxlen=100)
        def my_callback(item):
            print "I just appended something"
        buf.subscribe(my_callback)
        for i in range(5):
            buf.append(i)

    """

    def __init__(self, maxlen=200):
        self.callbacks = dict()
        super(EventDeque, self).__init__(maxlen=maxlen)


    def __str__(self):
        return str( len(self) )

        
    def append(self, item):
        super(EventDeque, self).append(item)
        for callback in self.callbacks.values():
            callback(item)

        
    def append_list(self, l):
        super(EventDeque, self).extend(item for item in l)
        for callback in self.callbacks.values():
            callback(l)


    def subscribe(self, identifier, callback):
        self.callbacks[identifier] = callback


    def unsubscribe(self, identifier):
        del self.callbacks[identifier]



class CacheMember(SerializableMixin):
    def __init__(self, events, tree):
        self._sorted_tree = None
        self.tree = tree
        self.events = events

    @classmethod
    def from_init_event(cls, nodes, maxlen=200):
        tree = nx.DiGraph()
        tree.add_node(0, name="root")
        events = EventDeque(maxlen=maxlen)
        cachemember = cls(events, tree)
        cachemember.update_tree(nodes)
        return cachemember


    def update_tree(self, nodes):
        for n in nodes:
            name = n.pop('name')
            self.tree.add_node(name, **n)
        for child_key, data in islice(self.tree.nodes(data=True), 1, None):
            parent_keys = data.get("task_dep", None) or [0]
            for parent_key in parent_keys:
                if parent_key not in self.tree:
                    self.tree.add_node(parent_key)
                    self.tree.add_edge(parent_key, 0)
                self.tree.add_edge(child_key, parent_key)
        self._sorted_tree = None


    def _custom_serialize(self):
        return { "events": list(self.events),
                 "tree": self.tree.nodes(data=True) }



class AgeDict(dict):
    """Keep ages for each element"""
    DEFAULT_TTL = 24*60*60 # 1 day in seconds
    
    def __init__(self, *args, **kwargs):
        super(AgeDict, self).__init__(*args, **kwargs)
        now = time.time()
        self.ages = dict([(k, now) for k in self])


    def clean(self, olderthan=DEFAULT_TTL):
        cutoff = time.time() - olderthan
        i = 0
        for k in self:
            if self.ages[k] < cutoff:
                del self[k]
                i += 1
        return i

    def __getitem__(self, key):
        # get the item first in case of exception in superclass
        item = super(AgeDict, self).__getitem__(key)
        self.ages[key] = time.time()
        return item

    def __setitem__(self, key, value):
        ret = super(AgeDict, self).__setitem__(key, value)
        self.ages[key] = time.time()
        return ret

    def __delitem__(self, key):
        ret = super(AgeDict, self).__delitem__(key)
        del self.ages[key]
        return ret

    def __conatins__(self, key):
        ret = super(AgeDict, self).__contains__(key)
        self.ages[key] = time.time()
        return ret
