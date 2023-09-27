import { default as seagulls } from '../../seagulls.js'

const WORKGROUP_SIZE = 4,
      GRID_SIZE = 16,
      NUM_AGENTS = 16

const W = Math.round( window.innerWidth  / GRID_SIZE ),
      H = Math.round( window.innerHeight / GRID_SIZE )

const render_shader = seagulls.constants.vertex + `
struct VertexInput {
  @location(0) pos: vec2f,
  @builtin(instance_index) instance: u32,
}

struct Vant {
  pos: vec2f,
  dir: f32,
  flag: f32
}

@group(0) @binding(0) var<storage> vants: array<Vant>;
@group(0) @binding(1) var<storage> pheromones: array<f32>;
@group(0) @binding(2) var<storage> render: array<f32>;

@fragment 
fn fs( @builtin(position) pos : vec4f ) -> @location(0) vec4f {
  let grid_pos = floor( pos.xy / ${GRID_SIZE}.);
  
  let pidx = grid_pos.y  * ${W}. + grid_pos.x;
  let p = pheromones[ u32(pidx) ];
  let v = render[ u32(pidx) ];

  let out = select( vec3(p) , vec3(1.,0.,0.), v==1. );
  
  return vec4f( out, 1. );
}`

const compute_shader =`
struct Vant {
  pos: vec2f,
  dir: f32,
  flag: f32
}

@group(0) @binding(0) var<storage, read_write> vants: array<Vant>;
@group(0) @binding(1) var<storage, read_write> pheremones: array<f32>;
@group(0) @binding(2) var<storage, read_write> render: array<f32>;

fn vantIndex( cell:vec3u ) -> u32 {
  let size = ${WORKGROUP_SIZE}u;
  return cell.x + (cell.y * size); 
}

fn pheromoneIndex( vant_pos: vec2f ) -> u32 {
  let width = ${W}.;
  return u32( vant_pos.y * width + vant_pos.x );
}

@compute
@workgroup_size(4,4,1)

fn cs(@builtin(global_invocation_id) cell:vec3u)  {
  let pi2   = ${Math.PI*2};
  let index = vantIndex( cell );
  var vant:Vant  = vants[ index ];

  let pIndex    = pheromoneIndex( vant.pos );
  let pheromone = pheremones[ pIndex ];

  // if pheromones were found
  if( pheromone != 0. ) {
    vant.dir += .25; // turn 90 degrees counter-clockwise
    vant.flag = 0.;  // set pheromone flag
  }else{
    vant.dir -= .25; // turn clockwise
    vant.flag = 1.;  // unset pheromone flag
  }

  // calculate direction based on vant heading
  let dir = vec2f( cos( vant.dir * pi2 ), sin( vant.dir * pi2 ) );
  
  vant.pos = round( vant.pos + dir ); 

  vants[ index ] = vant;
  
  pheremones[ pIndex ] = vant.flag;
  render[ pIndex ] = 1.;
}`
 
const s = await seagulls.init()

const NUM_PROPERTIES = 4 // must be evenly divisble by 4!
const pheromones = new Float32Array( W*H )
const vants      = new Float32Array( NUM_AGENTS * NUM_PROPERTIES )
const vants_render = new Float32Array( W*H )

for( let i = 0; i < NUM_AGENTS * NUM_PROPERTIES; i+= NUM_PROPERTIES ) {
  vants[ i ]   = Math.floor( Math.random() * W )
  vants[ i+1 ] = Math.floor( Math.random() * H )
  vants[ i+2 ] = 0
  vants[ i+3 ] = 0
}

s.buffers({
  vants:vants,
  pheromones:pheromones,
  vants_render
})
.backbuffer( false )
.compute( compute_shader, 1 )
.render( render_shader )
.onframe( ()=> { 
  s.device.queue.writeBuffer(s.__buffers.vants_render, 0, vants_render, 0, vants_render.length * 4);
})
.run( 1, 100 )