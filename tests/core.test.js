import test from 'node:test';
import assert from 'node:assert/strict';
import {contains, inside, intersect, fromPoints, clampPoint, moveRect, resizeRect, handles, handleAt, physicalRect, alignedPaintRect} from '../src/core/geometry.js';
import {Editor, annotationHit} from '../src/core/editor.js';

test('selection handles remain available while an annotation tool is active', () => {
    const e = new Editor({monitors: [{x: 0, y: 0, width: 800, height: 600}]});
    e.selectMonitor({x: 100, y: 100});
    e.setTool('arrow');
    e.pointerDown({x: 800, y: 300});
    assert.equal(e.interaction, 'selection-resize');
    e.pointerUp({x: 700, y: 300});
    assert.equal(e.selection.width, 700);
    assert.deepEqual(e.annotations, []);
    assert.equal(e.draft, null);
});
const monitors=[{x:0,y:0,width:500,height:400,scale:2},{x:500,y:0,width:300,height:400,scale:1}];
const windows=[{x:450,y:30,width:100,height:100},{x:30,y:30,width:200,height:180}];
const editor=()=>new Editor({monitors,windows});
function drag(e,a,b,opts={}) { e.pointerDown(a,opts); e.pointerMove(b,opts); e.pointerUp(b,opts); }
function selection(e) { drag(e,{x:20,y:20},{x:400,y:350}); }
function draw(e,type,a={x:80,y:80},b={x:200,y:160},opts={}) { e.setTool(type); drag(e,a,b,opts); e.setTool(null); }
test('geometry normalizes, clips, moves, and exposes eight handles',()=>{
 assert.deepEqual(fromPoints({x:8,y:9},{x:2,y:3}),{x:2,y:3,width:6,height:6});
 assert.deepEqual(intersect({x:0,y:0,width:10,height:10},{x:8,y:-2,width:6,height:5}),{x:8,y:0,width:2,height:3});
 assert.equal(intersect({x:0,y:0,width:2,height:2},{x:2,y:0,width:2,height:2}),null);
 assert.equal(contains({x:0,y:0,width:10,height:10},{x:10,y:10}),true);
 assert.equal(inside({x:0,y:0,width:10,height:10},{x:5,y:5}),true); assert.equal(inside({x:0,y:0,width:10,height:10},{x:0,y:5}),false); assert.equal(inside({x:0,y:0,width:10,height:10},{x:20,y:5}),false);
 assert.deepEqual(clampPoint({x:-1,y:12},{x:0,y:0,width:10,height:10}),{x:0,y:10});
 assert.deepEqual(moveRect({x:2,y:2,width:4,height:4},20,-10,{x:0,y:0,width:10,height:10}),{x:6,y:0,width:4,height:4});
 assert.deepEqual(resizeRect({x:2,y:2,width:4,height:4},'nw',{x:8,y:9},{x:0,y:0,width:10,height:10}),{x:6,y:6,width:2,height:3});
 assert.equal(handles({x:0,y:0,width:20,height:20}).length,8); assert.equal(handleAt({x:0,y:0,width:20,height:20},{x:10,y:0}), 'n');
});
test('hover and click choose topmost window clipped to the starting monitor',()=>{
 const e=editor(); e.pointerMove({x:470,y:50}); assert.deepEqual(e.hover,{x:450,y:30,width:50,height:100});
 drag(e,{x:470,y:50},{x:472,y:52}); assert.deepEqual(e.selection,{x:450,y:30,width:50,height:100});
 const blank=editor(); drag(blank,{x:400,y:300},{x:400,y:300}); assert.equal(blank.selection,null);
});
test('selection drag and movement stay on starting monitor without moving annotations',()=>{
 const e=editor(); drag(e,{x:400,y:300},{x:800,y:-10}); assert.deepEqual(e.selection,{x:400,y:0,width:100,height:300});
 e.selectMonitor({x:20,y:20}); e.nudge(10,10); assert.equal(e.selection.x,0);
 e.selection={x:20,y:20,width:300,height:250}; draw(e,'rectangle'); const before=structuredClone(e.annotations);
 drag(e,{x:250,y:200},{x:300,y:220}); assert.deepEqual(e.annotations,before); assert.equal(e.selection.x,70);
 e.nudge(1,1,true); assert.equal(e.selection.width,301);
});
test('shape hit testing distinguishes empty interiors and topmost objects',()=>{
 const e=editor(); selection(e); draw(e,'rectangle'); assert.equal(annotationHit(e.annotations[0],{x:140,y:120}),false);
 draw(e,'pixelate',{x:100,y:90},{x:180,y:150}); e.pointerDown({x:140,y:120}); assert.equal(e.selectedId,e.annotations[1].id); e.pointerUp({x:140,y:120});
 assert.equal(annotationHit({type:'circle',width:3,x1:0,y1:0,x2:100,y2:100},{x:50,y:50}),false);
 assert.equal(annotationHit({type:'arrow',width:3,x1:0,y1:0,x2:100,y2:100},{x:50,y:50}),true);
});
test('drawing, moving, resizing, styling and deletion are undoable',()=>{
 const e=editor(); selection(e); draw(e,'rectangle'); const initial=structuredClone(e.annotations);
 drag(e,{x:140,y:80},{x:160,y:100}); assert.equal(e.annotations[0].x1,100); assert.equal(e.undo(),true); assert.deepEqual(e.annotations,initial); assert.equal(e.redo(),true);
 const moved=structuredClone(e.annotations); drag(e,{x:100,y:100},{x:50,y:40}); assert.equal(e.annotations[0].x1,50); e.undo(); assert.deepEqual(e.annotations,moved);
 e.setStyle({color:'#00f',width:6}); assert.equal(e.annotations[0].color,'#00f'); e.undo(); assert.equal(e.annotations[0].color,'#ff0000'); e.redo();
 e.deleteSelected(); assert.equal(e.annotations.length,0); e.undo(); assert.equal(e.annotations.length,1); e.undo(); draw(e,'arrow'); assert.equal(e.redo(),false);
});
test('arrow endpoints, circle shift, text, escape',()=>{
 const e=editor(); selection(e); draw(e,'circle',{x:80,y:80},{x:130,y:100},{shift:true}); assert.equal(e.annotations[0].x2,130); assert.equal(e.annotations[0].y2,130);
 draw(e,'arrow',{x:220,y:100},{x:320,y:150}); e.pointerDown({x:270,y:125}); e.pointerUp({x:270,y:125}); drag(e,{x:320,y:150},{x:350,y:180}); assert.equal(e.annotations[1].x1,220); assert.equal(e.annotations[1].x2,350);
 e.setTool('text'); assert.deepEqual(e.pointerDown({x:90,y:200}),{newText:{x:90,y:200}}); const id=e.addText({x:90,y:200},'hello'); e.setTool(null); assert.deepEqual(e.pointerDown({x:105,y:205},{clickCount:2}),{editText:id}); e.updateText(id,'hello\nworld'); assert.equal(e.annotations.at(-1).text,'hello\nworld'); e.undo(); assert.equal(e.annotations.at(-1).text,'hello'); assert.equal(e.escape(),'handled'); assert.equal(e.escape(),'close');
});

test('monitor boundary is half open and drag threshold is five pixels', () => {
    const e = editor();
    assert.equal(e.selectMonitor({x: 500, y: 100}), true);
    assert.equal(e.selection.x, 500);
    const click = editor();
    drag(click, {x: 40, y: 40}, {x: 44, y: 40});
    assert.deepEqual(click.selection, windows[1]);
    const threshold = editor();
    drag(threshold, {x: 40, y: 40}, {x: 43, y: 44});
    assert.deepEqual(threshold.selection, {x: 40, y: 40, width: 3, height: 4});
    const line = editor();
    drag(line, {x: 40, y: 40}, {x: 80, y: 40});
    assert.equal(line.selection, null);
});

test('each selection handle resizes and cannot collapse the selection', () => {
    const expected = {
        nw: {x: 90, y: 90, width: 110, height: 110},
        n: {x: 100, y: 90, width: 100, height: 110},
        ne: {x: 100, y: 90, width: 110, height: 110},
        e: {x: 100, y: 100, width: 110, height: 100},
        se: {x: 100, y: 100, width: 110, height: 110},
        s: {x: 100, y: 100, width: 100, height: 110},
        sw: {x: 90, y: 100, width: 110, height: 110},
        w: {x: 90, y: 100, width: 110, height: 100},
    };
    for (const h of handles({x: 100, y: 100, width: 100, height: 100})) {
        const e = editor();
        e.selectMonitor({x: 1, y: 1});
        e.selection = {x: 100, y: 100, width: 100, height: 100};
        const dx = h.id.includes('w') ? -10 : h.id.includes('e') ? 10 : 0;
        const dy = h.id.includes('n') ? -10 : h.id.includes('s') ? 10 : 0;
        drag(e, h, {x: h.x + dx, y: h.y + dy});
        assert.deepEqual(e.selection, expected[h.id], h.id);
    }
    const e = editor();
    e.selectMonitor({x: 1, y: 1});
    e.selection = {x: 100, y: 100, width: 100, height: 100};
    drag(e, {x: 200, y: 150}, {x: 100, y: 150});
    assert.equal(e.selection.width, 1);
    e.nudge(-1, 0, true);
    assert.equal(e.selection.width, 1);
});

test('text measurements follow styles, and no-op actions preserve redo', () => {
    const e = new Editor({monitors, measureText: ({text, width}) => ({width: text.length * width, height: width * 2})});
    e.selectMonitor({x: 1, y: 1});
    const id = e.addText({x: 100, y: 100}, 'abc');
    e.setTool(null);
    e.pointerDown({x: 103, y: 103});
    e.pointerUp({x: 103, y: 103});
    e.setStyle({width: 6});
    assert.equal(e.annotations[0].x2, 118);
    assert.equal(e.annotations[0].y2, 112);
    e.undo();
    assert.equal(e.annotations[0].x2, 109);
    e.setStyle({color: e.annotations[0].color});
    assert.equal(e.redo(), true);
    assert.equal(e.annotations[0].x2, 118);
    // A selected text corner moves the text rather than resizing it.
    drag(e, {x: 100, y: 100}, {x: 110, y: 110});
    assert.equal(e.annotations[0].x1, 110);
    assert.equal(e.annotations[0].x2, 128);
    assert.equal(e.annotations[0].id, id);
});

test('a press strictly inside the selection near a corner draws, while a press just outside still resizes', () => {
    const e = editor();
    e.selectMonitor({x: 1, y: 1});
    e.selection = {x: 100, y: 100, width: 200, height: 150};
    e.setTool('rectangle');
    e.pointerDown({x: 103, y: 103});
    assert.equal(e.interaction, 'draw');
    e.pointerMove({x: 150, y: 140});
    e.pointerUp({x: 150, y: 140});
    assert.deepEqual(e.selection, {x: 100, y: 100, width: 200, height: 150});
    assert.equal(e.annotations.length, 1);
    assert.equal(e.annotations[0].type, 'rectangle');
    e.pointerDown({x: 97, y: 97});
    assert.equal(e.interaction, 'selection-resize');
    e.pointerMove({x: 90, y: 90});
    e.pointerUp({x: 90, y: 90});
    assert.deepEqual(e.selection, {x: 90, y: 90, width: 210, height: 160});
});

test('physicalRect rounds both edges so the size matches the pixel grid', () => {
    const s = 1.3333333730697632;
    // x 10*s = 13.33 -> 13, y 7*s = 9.33 -> 9; right 610*s = 813.33 -> 813, bottom 407*s = 542.67 -> 543.
    assert.deepEqual(physicalRect({x: 10, y: 7, width: 600, height: 400}, s), {x: 13, y: 9, width: 800, height: 534});
    assert.deepEqual(physicalRect({x: 3, y: 4, width: 5, height: 6}, 2), {x: 6, y: 8, width: 10, height: 12});
    assert.deepEqual(physicalRect({x: 10, y: 7, width: 600, height: 400}, 1), {x: 10, y: 7, width: 600, height: 400});
});

test('alignedPaintRect covers the physical rect with a grid-aligned logical origin', () => {
    const s = 1.3333333730697632;
    // q = 3 (3*s = 4.0000001). x: 13/s/3 = 3.25 -> 3 -> 9; y: 9/s/3 = 2.25 -> 2 -> 6;
    // right: 813/s/3 = 203.25 -> 204 -> 612; bottom: 543/s/3 = 135.75 -> 136 -> 408.
    // offsets: 13 - round(9*s = 12) = 1, 9 - round(6*s = 8) = 1; texture 804x536 holds 1+800 and 1+534.
    assert.deepEqual(alignedPaintRect(physicalRect({x: 10, y: 7, width: 600, height: 400}, s), s),
        {rect: {x: 9, y: 6, width: 603, height: 402}, offsetX: 1, offsetY: 1});
    // Integer scales: q = 1, the rect is the selection and offsets are 0.
    assert.deepEqual(alignedPaintRect(physicalRect({x: 10, y: 7, width: 600, height: 400}, 1), 1),
        {rect: {x: 10, y: 7, width: 600, height: 400}, offsetX: 0, offsetY: 0});
    // Scale 2: physical {20, 14, 1200, 800} -> logical {10, 7, 600, 400}, offsets 0.
    assert.deepEqual(alignedPaintRect(physicalRect({x: 10, y: 7, width: 600, height: 400}, 2), 2),
        {rect: {x: 10, y: 7, width: 600, height: 400}, offsetX: 0, offsetY: 0});
    // Scale 1.25: q = 4 (4*1.25 = 5). physical: x 12.5 -> 13, y 8.75 -> 9, right 762.5 -> 763, bottom 508.75 -> 509,
    // so {13, 9, 750, 500}. Aligned x: 13/1.25/4 = 2.6 -> 2 -> 8; y: 9/1.25/4 = 1.8 -> 1 -> 4;
    // right: 763/1.25/4 = 152.6 -> 153 -> 612; bottom: 509/1.25/4 = 101.8 -> 102 -> 408.
    // offsets: 13 - 8*1.25 = 3, 9 - 4*1.25 = 4.
    const p = physicalRect({x: 10, y: 7, width: 600, height: 400}, 1.25);
    assert.deepEqual(p, {x: 13, y: 9, width: 750, height: 500});
    assert.deepEqual(alignedPaintRect(p, 1.25), {rect: {x: 8, y: 4, width: 604, height: 404}, offsetX: 3, offsetY: 4});
    // 1.37 has no q in 1..16 with q*scale within 1e-4 of an integer.
    assert.equal(alignedPaintRect({x: 14, y: 10, width: 822, height: 548}, 1.37), null);
});
