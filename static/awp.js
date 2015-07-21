settings = {
    event_colors : { init:   "primary", skip:    "default", fail:    "danger",
		     finish: "primary", success: "success", execute: "info" }

    , status_colors : { skip: "#777",    fail:      "#f2dede", done: "#dff0d8",
			wait: "#5bc0de", undefined: "#777" }
    , event_to_status : { skip: "skip", execute: "wait", success: "done",
			  fail: "fail" }
    , new_event_hooks: {}
    , MAX_EVENTS : 100
    , dag: { initial_scale: 0.75 }
}

util = {
    lt : function (val, argidx){
	argidx = ! (argidx)? 0: argidx;
	return function (){
	    return arguments[argidx] < val;
	}
    }
    , gt : function (val, argidx){
	argidx = ! (argidx)? 0: argidx;
	return function (){
	    return arguments[argidx] > val;
	}
    }
    , keys : function keys(obj){
	var thekeys = new Array;
	for (prop in obj){ 
	    if (obj.hasOwnProperty(prop))
		thekeys.push(prop);
	}
	return thekeys;
    }
    , values : function keys(obj){
	var thevals = new Array;
	for (prop in obj){ 
	    if (obj.hasOwnProperty(prop))
		thevals.push(obj[prop]);
	}
	return thevals;
    }
}

function on_new_event_slider(e){
    var title = e.data.name === undefined? e.type : task_basename(e.data.name)
    , $events = $('#events')
    , event_html = (
	'<div class="panel-{color}">'+
	  '<div class="panel-heading"><h4 class="panel-title">{t}</h4></div>'+
	  '<div class="panel-body"><pre>'+
	    '{content}'+
	  '</pre></div>'+
	'</div>');

    $events.prepend(event_html.
		    replace("{t}", title ).
		    replace("{color}", settings.event_colors[e.type]).
		    replace("{content}", JSON.stringify(e, null, 2)));

    var cs = $events.children();
    if (cs.length > settings.MAX_EVENTS)
	for (i = cs.length-1; i > settings.MAX_EVENTS; i--)
	    $(cs[i]).remove();
}

function message(level, msg, duration){
    var duration = duration === undefined? 3000 : duration
    , to_append = $(
	'<div class="alert alert-'+level+'" role="alert"><b>'+level+':  </b>'
	    +msg+
	    '</div>'
    );

    $("#messages").append(to_append);
    setTimeout(function(){
	to_append.fadeTo(500,0).slideUp(500, function(){$(this).remove();});
    }, duration);
}

function project_load_error(_, _, reason){
    $("available_projects").empty();
    message("danger", "Unable to load projects: "+reason)
}

function load_projects(el){
    // only load on opening the dropdown, not closing
    if (el !== undefined && el.getAttribute('aria-expanded') !== "true")
	return;

    $.getJSON("api/").
	fail(project_load_error).
	done(function(data, status){
	    if (status !== "success") return project_load_error();
	    $("#available_projects").empty()
	    $("#available_projects").append(
		data.projects.map(function(p){
		    return '<li><a href="#'+p+'">'+p+'</a></li>';
		})
	    );
	});
}

function project_route() {
    var project_name = window.location.hash.replace("#", "");
    if (project_name) return draw_project(project_name);
}

function task_basename(t){
    var arr = t.split(":");
    return arr.filter(util.lt(arr.length-1, 1)).join(":");
}

function new_event(e) {
    var e = {type: e[0], time: e[1], data: e[2]};
    util.values(settings.new_event_hooks).map(function(hook_fn){ hook_fn(e); });
    
}

function subscribe_project(name) {
    settings.new_event_hooks.slider = on_new_event_slider;
    var host = window.location.origin.replace("http://", "")
    , url = "ws://"+host+"/api/"+name+"/socket"
    , sock = new WebSocket(url);
    sock.onmessage = function(event) {
	$.parseJSON(event.data).map(new_event);
    }
}

function draw_project_dag(data) {
    var nodes_obj = new Object
    , svg = d3.select("#dag svg")
    , inner = d3.select("#dag g")
    , g = new dagreD3.graphlib.Graph().setGraph({rankdir:"LR"})
    , render = new dagreD3.render()
    , zoom = d3.behavior.zoom().on("zoom", function() {
	inner.attr("transform", "translate("+d3.event.translate+")"+
		                    "scale("+d3.event.scale+")");
    });

    data.tree.forEach(function(n){
	if (n[0] === 0) return;
	g.setNode(n[0], {label: task_basename(n[0])});
    });
    data.tree.forEach(function(n){
	if (n[0] === 0) return;
	var deps = n[1].task_dep
	, node = g.node(n[0]);
	deps.forEach(function(dep){
	    g.setEdge(dep, n[0], {label: ""});
	});
	node.rx = node.ry = 5;
	node.style = "fill: "+settings.status_colors[n[1].status];
    });
    settings.new_event_hooks.dag = function(e) {
	if (e.data.name === undefined)
	    return;
	var color = settings.status_colors[settings.event_to_status[e.type]];
	g.node(e.data.name).elem.children[0].style.fill = color;
    };
    svg.call(zoom);
    render(inner, g);
    zoom.
	translate([(svg.attr("width") - g.graph().width * settings.dag.initial_scale) / 2, 20]).
	scale(settings.dag.initial_scale).
	event(svg);
    svg.attr("height", g.graph().height*settings.dag.initial_scale + 40);
}


function draw_project(name) {
    subscribe_project(name);
    $.getJSON("api/"+name).
	fail(function(_, _, reason){message("danger", reason);}).
	done(function(data, status){
	    if (status !== "success") return message(
		"danger", "Unexpected project load status "+status);
	    data.events.map(new_event);
	    draw_project_dag(data);
	});
}

$(function() {
    project_route();
    window.onhashchange = project_route;
});
