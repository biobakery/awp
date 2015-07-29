var settings = {
    api_url: "/api"
    , event_colors : { init:   "primary", skip:    "default", fail:    "danger",
		     finish: "primary", success: "success", execute: "info" }

    , status_colors : { skip: "#777",    fail:      "#f2dede", done: "#dff0d8",
			wait: "#5bc0de", undefined: "#777" }
    , event_to_status : { skip: "skip", execute: "wait", success: "done",
			  fail: "fail" }
    , status_to_event_color : { skip: "default", fail: "danger", wait: "info",
				done: "success", undefined: "default"}
    , new_event_hooks: {}
    , MAX_EVENTS : 100
    , dag: { initial_scale: 0.75 }
};

const util = {
    lt : function (val, argidx){
	argidx = ! (argidx)? 0: argidx;
	return function (){
	    return arguments[argidx] < val;
	};
    }
    , gt : function (val, argidx){
	argidx = ! (argidx)? 0: argidx;
	return function (){
	    return arguments[argidx] > val;
	};
    }
    , keys : function (obj){
	var thekeys = new Array;
	for (prop in obj){ 
	    if (obj.hasOwnProperty(prop))
		thekeys.push(prop);
	}
	return thekeys;
    }
    , values : function (obj){
	var thevals = new Array;
	for (prop in obj){ 
	    if (obj.hasOwnProperty(prop))
		thevals.push(obj[prop]);
	}
	return thevals;
    }
    , update : function (obj_a, obj_b) {
	for (prop in obj_b) {
	    if (! obj_b.hasOwnProperty(prop))
		continue;
	    obj_a[prop] = obj_b[prop];
	}
    }
    , each : function (arr, fn){
	for (var i = 0, len = arr.length; i < len; i++)
	    fn(arr[i]);
    }
    , has : function (obj, key){
	return (obj[key] !== undefined && obj.hasOwnProperty(key));
    }
    , last : function (arr){
	var l = arr.length; return l > 0? arr[l-1] : undefined;
    }
    , repeat : function(x, times){
	var ret = new Array();
	for (var i = 0; i < times; i++)
	    ret.push(x);
	return ret;
    }
    , format : function(s, vals){
	util.keys(vals).map(function(key){
	    s = s.replace("{"+key+"}", vals[key]);
	});
	return s;
    }
    , escapeMap : {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	'"': '&quot;',
	"'": '&#39;',
	"/": '&#x2F;'
    }
    , escapeHtml : function(s) {
	return String(s).replace(/[&><"'\/]/g, function(r){
	    return util.escapeMap[r];
	});
    }
    , maybe : function(x, alt) { return x === undefined? alt : x; }
    , id : function(x) { return x; }
    , bool : function(x) { return x? true : false; }
};

const api = {
    get : function (url){
	url = url === undefined? "" : url;
	return $.getJSON(settings.api_url+"/"+url);
    }
};

function on_new_event_slider(e){
    var title = e.data.name === undefined? e.type : task_basename(e.data.name)
    , $events = $('#events')
    , event_template = (
	'<div class="panel panel-{color}">'+
	  '<div class="panel-heading">'+
	    '<span class="glyphicon glyphicon-menu-up pull-left pointy" '+
	           'onclick="toggle_event_view(this);" '+
	           'style="padding: 2px 10px 0px 0px;"></span>'+
	    '<h4 class="panel-title">{t}</h4>'+
	  '</div>'+
	  '<div class="panel-body hidden">'+
	    '{content}'+
	  '</div>'+
	'</div>');

    var thedate = new Date(e.time*1000)
    , content = '<h4><small>'+thedate.toString()+'</small></h4>';

    if (e.type == "success" || e.type == "fail") {
	content = content + '<span class="glyphicon glyphicon-time"></span> &nbsp; '+e.data.time+' seconds';
	util.each(["outs", "errs"], function(key){
	    var outs = e.data[key].filter(util.id)
	    , label = key == "outs"? "Stdout" : "Stderr";
	    if (outs.length === 0)
		return;
	    content = content + "<p>";
	    content = content + "<strong>"+label+"</strong>";
	    util.each(outs, function(str){
		content = content + "<pre>"+util.escapeHtml(str)+"</pre>";
	    });
	    content = content + "</p>";
	});
    }
    
    $events.prepend(
	util.format(event_template,{t: title
				    , color: settings.event_colors[e.type]
				    , content: content})
    );

    var cs = $events.children();
    if (cs.length > settings.MAX_EVENTS)
	for (var i = cs.length-1; i > settings.MAX_EVENTS; i--)
	    $(cs[i]).remove();
}

function show_task(t){
    var $task_view = $('#task').empty()
    , html = (
	'<div class="panel panel-{color}">'+
	  '<div class="panel-heading">'+
	    '<span class="glyphicon glyphicon-remove pull-left pointy" '+
	           'style="padding: 2px 10px 0px 0px;" '+
	           'onclick="$(this).parent().parent().empty();"></span>'+
	    '<h4 class="panel-title">{t}</h4>'+
	  '</div>'+
	  '<div class="panel-body"><pre>'+
	    '{content}'+
	  '</pre></div>'+
	'</div>'
    );

    $task_view.html(html.
		    replace("{t}", task_basename(t.data.name)).
		    replace("{color}",settings.status_to_event_color[t.status]).
		    replace("{content}", JSON.stringify(t, null, 2)));
    
}

function toggle_event_view(el) {
    var dn = "glyphicon-menu-down"
    , up = "glyphicon-menu-up"
    , $el = $(el);
    if (el.className.match(/-up/)){
	$el.parent().siblings().removeClass("hidden").addClass("show");	
	$el.removeClass(up).addClass(dn);
    } else {
	$el.parent().siblings().removeClass("show").addClass("hidden");
	$el.removeClass(dn).addClass(up);
    }
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
    message("danger", "Unable to load projects: "+reason);
}

function load_projects(el){
    if (el === undefined)
	return;

    api.get().
	fail(project_load_error).
	done(function(data, status){
	    if (status !== "success") return project_load_error();
	    $("#available_projects").empty();
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

function stdevent(e_arr){
    return {type: e_arr[0], time: e_arr[1], data: e_arr[2]};
}

function new_event(e) {
    util.values(settings.new_event_hooks)
	.map(function(hook_fn){
	    hook_fn(stdevent(e));
	});
}

function subscribe_project(name) {
    window.timeline = EventTimeline();
    settings.new_event_hooks.slider = on_new_event_slider;
    settings.new_event_hooks.timeline = window.timeline.add_event;
    var host = window.location.origin.replace("http://", "")
    , url = "ws://"+host+"/api/"+name+"/socket"
    , sock = new WebSocket(url);
    sock.onmessage = function(event) {
	$.parseJSON(event.data).map(new_event);
    };
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

    util.each(data.tree, function(n){
	if (n[0] === 0) return;
	g.setNode(n[0], {label: task_basename(n[0]),
			 rx: 5, ry: 5,
			 taskname: n[0]});
    });
    util.each(data.tree, function(n){
	if (n[0] === 0) return;
	var deps = n[1].task_dep, node = g.node(n[0]);
	util.each(deps, function(dep){
	    g.setEdge(dep, n[0], {label: ""});
	});
	node.style = "fill: " + settings.status_colors[n[1].status];
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
    d3.selectAll("g.node").
	classed("pointy", true).
	on("click", function(name){
	    show_task(window.timeline.tasks[name]);
	});
}

function EventTimeline(events) {
    var lanes = [[]]
    , tasks = {}
    , callbacks = {};

    function _update_tasks(e) {
	var t;
	if ( ! util.has(tasks, e.data.name))
	    t = tasks[e.data.name] = {data: {}};
	else
	    t = tasks[e.data.name];
	
	util.update(t.data, e.data);

	switch (e.type) {
	case "execute":
	    t.status = "wait";
	    t.start = new Date(e.time*1000);
	    break;
	case "skip":
	    t.status = "skip";
	    t.start = t.stop = new Date(e.time*1000);
	    break;
	case "success":
	    t.status = "done";
	    t.stop = new Date(e.time*1000);
	    break;
	case "fail":
	    t.status = "fail";
	    t.stop = new Date(e.time*1000);
	    break;
	}
	return t;
    }

    function clear() {
	lanes = [[]];
	tasks = {};
    }

    function _add_event(e) {
	if (e.data.name === undefined) return undefined;
	var t = _update_tasks(e);
	if (util.has(t, "lane")) return t;
	for (var i = 0; i < lanes.length; i++){
	    var lane = lanes[i], latest = util.last(lane);
	    if (   (latest === undefined)
		|| (latest.stop !== undefined && latest.stop < t.start)) {
		t.lane = i;
		lane.push(t);
		return t;
	    }
	}
	t.lane = lanes.length;
	lanes.push([t]);
	return t;
    }

    function add_event(e){
	var maybe_t = _add_event(e);
	if (maybe_t !== undefined)
	    util.values(callbacks).map(function(cb) {cb(maybe_t);});
    }

    if (events)
	util.each(events, add_event);

    return { lanes: lanes
	     , tasks: tasks
	     , callbacks: callbacks
	     , add_event: add_event
	     , clear: clear };
}

function draw_project_gannt(data) {
    var margin = {top: 40, right: 5, bottom: 30, left: 5 }
    , width = 800 - margin.left - margin.right
    , height = 500 - margin.top - margin.bottom
    , start = new Date(data.events[0][1]*1000)
    , end = new Date(util.last(data.events)[1]*1000)
    , timeline = window.timeline
    , n_workers = timeline.lanes.length;

    var x = d3.time.scale().domain([start, end]).range([5, width])
    , y = d3.scale.ordinal().domain(d3.range(n_workers)).
	    rangeRoundBands([0, height], 0.1);

    var xAxis = d3.svg.axis().scale(x).orient("bottom")
    , yAxis = d3.svg.axis().scale(y).orient("left").tickFormat('');

    d3.select("#gannt svg").remove();

    var svg = d3.select("#gannt").append("svg").
	attr("width", width + margin.left + margin.right).
	attr("height", height + margin.top + margin.bottom).
	append("svg:g").
	attr("transform", 
	     "translate(" + margin.left + "," + margin.top + ")");

    svg.append("g").
	attr("class", "x axis").
	attr("transform", "translate(0,"+height+")").
	call(xAxis);

    svg.append("g").
	attr("class", "y axis").
	call(yAxis);

    function setup_lanes() {
	return svg.selectAll(".gannt").
	    data(timeline.lanes).
	    enter().append("g").
	    attr("class", "g");
    }
    
    function format_rect_static(selection) {
	selection.
	    attr("rx", 5).
	    attr("ry", 5).
	    classed("gannt pointy", true).
	    style("stroke", "#000");
    }

    function format_rect(selection) {
	selection.
	    attr("width", function(t){
		return x(util.maybe(t.stop, end))-x(t.start);
	    }).
	    attr("height", y.rangeBand()).
	    attr("x", function(t){ return x(t.start); }).
	    attr("y", function(t){ return y(t.lane); }).
	    style("fill", function(t){
		return settings.status_colors[t.status];
	    });
    }

    function add_rect_listeners(selection) {
	selection.
	    on("click", show_task).
	    on("mouseover", function(t){ 
		return window.tooltip.
		    style("visibility", "visible").
		    text(task_basename(t.data.name));
	    }).
	    on("mousemove", function(){ 
		return window.tooltip.
		    style("top", (d3.event.pageY-10)+"px").
		    style("left", (d3.event.pageX+10)+"px");
	    }).
	    on("mouseout", function(){ 
		return window.tooltip.style("visibility", "hidden"); 
	    });
    }
    
    var lanes = setup_lanes();

    lanes.selectAll("rect").data(util.id).enter().append("rect").
	call(format_rect_static).
	call(format_rect).
	call(add_rect_listeners);


    window.timeline.callbacks.gannt = function(task) {
	end = util.maybe(task.stop, task.start);
	n_workers = timeline.lanes.length;
	x = d3.time.scale().domain([start, end]).range([5, width]);
	y = d3.scale.ordinal().domain(d3.range(n_workers)).
	    rangeRoundBands([0, height], 0.1);
	xAxis = d3.svg.axis().scale(x).orient("bottom");
	yAxis = d3.svg.axis().scale(y).orient("left").tickFormat('');
	d3.selectAll("rect.gannt").transition().call(format_rect);
	if (!util.has(lanes, task.lane))
	    lanes.append("g").attr("class", "g");
	if (task.status == "wait" || task.status == "skip"){
	    d3.select(lanes[0][task.lane]).
		data([task]).append("rect").
		call(format_rect_static).
		call(format_rect).
		call(add_rect_listeners);
	}
	// transition x and y axes after modifying rects is important
	svg.select(".x").transition().call(xAxis);
	svg.select(".y").transition().call(yAxis);
    };
    
}

function draw_project(name) {
    $("#project_title").empty().html('<h1>Project status for <a href="#'+name+'">'+name+'</a></h1>');
    subscribe_project(name);
    api.get(name).
	fail(function(_, _, reason){message("danger", reason);}).
	done(function(data, status){
	    if (status !== "success") return message(
		"danger", "Unexpected project load status "+status);
	    data.events.map(new_event);
	    draw_project_gannt(data);
	    draw_project_dag(data);
	});
}

$(function() {
    project_route();
    window.onhashchange = project_route;

    window.tooltip = d3.select("body").
	append("div").
	style("position", "absolute").
	style("z-index", "10").
	style("visibility", "hidden").
	text("");
});
