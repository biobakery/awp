from cStringIO import StringIO

import ujson

class SerializationError(TypeError):
    pass


def _defaultfunc(obj):
    if hasattr(obj, '_serializable_attrs'):
        return obj._serializable_attrs
    elif hasattr(obj, 'isoformat'):
        return obj.isoformat()
        
    raise SerializationError("Unable to serialize object %s" %(obj))


def _dump(obj, fp, default):
    try:
        return ujson.dump(obj, fp)
    except:
        return ujson.dump(default(obj), fp)


def _dumps(obj, default):
    try:
        return ujson.dumps(obj)
    except:
        return ujson.dumps(default(obj))


def serialize(obj, to_fp=None):
    if to_fp:
        return _dump(obj, to_fp, default=_defaultfunc)
    else:
        return _dumps(obj, default=_defaultfunc)


def deserialize(s=None, from_fp=None):
    if s:
        return ujson.loads(s)
    elif from_fp:
        return ujson.load(from_fp)
    

class SerializableMixin(object):
    """Mixin that defines a few methods to simplify serializing objects
    """

    serializable_attrs = []

    @property
    def _serializable_attrs(self):
        if hasattr(self, "_custom_serialize"):
            return self._custom_serialize()
        else:
            return dict([
                (key, getattr(self, key))
                for key in self.serializable_attrs
            ])
        

def logformat_task_dict(name, data):
    log_f = StringIO()
    print >> log_f, "Log for task "+name
    print >> log_f, "status\t"+data.get("status", "")
    print >> log_f, "time\t"+str(data.get("time", ""))
    print >> log_f, ""
    for t in data.get('targets', []):
        print >> log_f, "\t".join(["target"]+map(str, t))
    print >> log_f, ""
    for f in data.get('file_dep', []):
        print >> log_f, "file_dep\t"+f
    print >> log_f, ""
    for out in data.get("outs", []):
        print >> log_f, "="*15 + "Stdout" + "="*15
        print >> log_f, out
        print >> log_f, "="*36
    for err in data.get("errs", []):
        print >> log_f, "="*15 + "Stderr" + "="*15
        print >> log_f, err
        print >> log_f, "="*36
    return log_f.getvalue()
