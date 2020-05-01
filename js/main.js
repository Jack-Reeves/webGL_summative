// Directional lighting demo: By Frederick Li
// Vertex shader program
var VSHADER_SOURCE =
  'attribute vec4 a_Position;\n' +
  'attribute vec4 a_Color;\n' +
  'attribute vec4 a_Normal;\n' +   // Normal
  'attribute vec2 a_TexCoords;\n' + // Texture coordinates

  'uniform mat4 u_ModelMatrix;\n' +
  'uniform mat4 u_NormalMatrix;\n' +
  'uniform mat4 u_ViewMatrix;\n' +
  'uniform mat4 u_ProjMatrix;\n' +
  'uniform bool u_isLighting;\n' +

  'varying vec4 v_Color;\n' +
  'varying vec2 v_TexCoords;\n' + 
  'varying vec3 v_Normal;\n' +
  

  'void main() {\n' +
  '  v_Color = a_Color;\n' + 
  '  gl_Position = u_ProjMatrix * u_ViewMatrix * u_ModelMatrix * a_Position;\n' +
  '  v_TexCoords = a_TexCoords;\n' +
  '  v_Normal = normalize((u_NormalMatrix * a_Normal).xyz);\n' +
    // Calculate nDotL
 // '  float nDotL = max(dot(normal, u_LightDirection), 0.0);\n' +
		// Calculate the color due to diffuse reflection
  //'  vec3 diffuse = u_LightColor * a_Color.rgb * nDotL;\n' +
    // Calculate due to ambient
//  '  vec3 ambient = u_AmbientLight * a_Color.rgb;\n' +
//'  v_Color = vec4(diffuse + ambient, a_Color.a);\n' +  
  '}\n';

// Fragment shader program
var FSHADER_SOURCE =
  '#ifdef GL_ES\n' +
  'precision mediump float;\n' +
  '#endif\n' +

  'varying vec4 v_Color;\n' +
  'varying vec2 v_TexCoords;\n' + 
  'varying vec3 v_Normal;\n' + 
  'uniform sampler2D u_sampler;\n' +
  'uniform vec3 u_LightDirection;\n' +
  'uniform vec3 u_LightColor;\n' +
  'uniform vec3 u_AmbientLight;\n' +
  
  'void main() {\n' +
    // Calculate normal
    'vec3 v_Normal = normalize(v_Normal);\n' +
    // Calculate light direction

    // Calculate nDotL
    'float nDotL = max(dot(v_Normal, u_LightDirection), 0.0);\n' +

    // Calculate texture color
  '  vec4 texColor = texture2D(u_sampler, v_TexCoords);\n' +
    // Diffuse with texture color 
  '  vec3 diffuse = u_LightColor * texColor.rgb * nDotL * 1.2;\n' +
    // Calculate Ambient 
  '  vec3 ambient = u_AmbientLight * v_Color.rgb;\n' +
    // Calculate Frag color
  '  gl_FragColor = vec4(diffuse + ambient, v_Color.a);\n' +
  '}\n';

  
// Web GL
var modelMatrix = new Matrix4(); // The model matrix
var viewMatrix = new Matrix4();  // The view matrix
var projMatrix = new Matrix4();  // The projection matrix
var g_normalMatrix = new Matrix4();  // Coordinate transformation matrix for normals
var texturesLoaded = 0;

var canvas; 
var gl; 
var u_ModelMatrix, u_isLighting, u_NormalMatrix, u_ViewMatrix, u_ProjMatrix, u_LightColor, u_LightDirection, u_AmbientLight;

var ANGLE_STEP = 3.0;  // The increments of rotation angle (degrees)
var g_xAngle = 0.0;    // The rotation x angle (degrees)
var g_yAngle = 0.0;    // The rotation y angle (degrees)
var g_xOffset = 0.0; 

// Animations
var shelfDoorAngle = 0;    // The rotation of the doors for the shelf
var drawerPulledOut = 0; // How far pulled out the drawer is as a percentage, for animation
var lampBaseRotation = 270; // Rotation of base of lamp
var lampLowerArmRotation = 30; // Rotation of the lower arm of the lamp
var lampUpperArmRotation = 60;  // Rotation of the upper arm of the lamp

// Camera related
var cameraIncrement = 0.3
var camera_x = 0; // Camera x position
var camera_y = 5; // Camera y position
var camera_z = 10; // Camera z position

var camera_angle_increment = 1.0;
var camera_flag = true;
var camera_pitch = 120;
var camera_yaw = 180; 
var camera_lookAt_x = camera_x + Math.sin(camera_yaw * Math.PI / 180) * Math.sin(camera_pitch * Math.PI / 180);  // The x co-ordinate the eye is looking at
var camera_lookAt_y = camera_y + Math.cos(camera_pitch * Math.PI / 180);  // The y co-ordinate the eye is looking at
var camera_lookAt_z = camera_z + Math.cos(camera_yaw * Math.PI / 180) * Math.sin(camera_pitch * Math.PI / 180);  // The z co-ordinate the eye is looking at

function main() {
  // Retrieve <canvas> element
  canvas = document.getElementById('glCanvas');

  // Get the rendering context for WebGL
  gl = getWebGLContext(canvas);
  if (!gl) {
	console.log('Failed to get the rendering context for WebGL');
	return;
  }

  // Initialize shaders
  if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
	console.log('Failed to intialize shaders.');
	return;
  }

  // Set clear color and enable hidden surface removal (light grey)
  gl.clearColor(0.5, 0.5, 0.5, 1);
  gl.enable(gl.DEPTH_TEST);

  // Clear color and depth buffer
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // Get the storage locations of uniform attributes
  u_ModelMatrix = gl.getUniformLocation(gl.program, 'u_ModelMatrix');
  u_ViewMatrix = gl.getUniformLocation(gl.program, 'u_ViewMatrix');
  u_NormalMatrix = gl.getUniformLocation(gl.program, 'u_NormalMatrix');
  u_ProjMatrix = gl.getUniformLocation(gl.program, 'u_ProjMatrix');
  u_LightColor = gl.getUniformLocation(gl.program, 'u_LightColor');
  u_LightDirection = gl.getUniformLocation(gl.program, 'u_LightDirection');
  u_sampler = gl.getUniformLocation(gl.program, 'u_sampler');
  u_AmbientLight = gl.getUniformLocation(gl.program, 'u_AmbientLight')

  // Trigger using lighting or not
  u_isLighting = gl.getUniformLocation(gl.program, 'u_isLighting'); 

  if (!u_ModelMatrix || !u_ViewMatrix || !u_NormalMatrix ||
	  !u_ProjMatrix || !u_LightColor || !u_LightDirection) { 
	console.log('Failed to Get the storage locations of u_ModelMatrix, u_ViewMatrix, and/or u_ProjMatrix');
	return;
  } 

  // Init textures
  initTextures();

  // Set the light color (white)
  gl.uniform3f(u_LightColor, 1.0, 1.0, 1.0);
  // Set the light direction (in the world coordinate)
  var lightDirection = new Vector3([0.5, 3.0, 4.0]);
  lightDirection.normalize();     // Normalize
  gl.uniform3fv(u_LightDirection, lightDirection.elements);

  // Calculate the view matrix and the projection matrix
  viewMatrix.setLookAt(camera_x, camera_y, camera_z, camera_lookAt_x, camera_lookAt_y, camera_lookAt_z, 0, 1, 0); // (Vector 1 = cam position), (Vector 2 = Position along direction to look at),  (Vector 3 = up Axis)
  projMatrix.setPerspective(30, canvas.width/canvas.height, 1, 100);
  // Pass the model, view, and projection matrix to the uniform variable respectively
  gl.uniformMatrix4fv(u_ViewMatrix, false, viewMatrix.elements);
  gl.uniformMatrix4fv(u_ProjMatrix, false, projMatrix.elements);

  document.onkeydown = function(ev){
	  keydown(ev, gl, u_ModelMatrix, u_NormalMatrix, u_isLighting);
  };

  requestAnimationFrame(animationLoop)
}

function animationLoop() {
  if(texturesLoaded == 8) { draw(gl, u_ModelMatrix, u_NormalMatrix, u_isLighting); }
  requestAnimationFrame(animationLoop)
}

function keydown(ev, gl, u_ModelMatrix, u_NormalMatrix, u_isLighting) {
  switch (ev.keyCode) {

  // Camera controls
  case 40: // Down arrow key -> +ve x-axis
    if (camera_flag) { 
      camera_pitch += camera_angle_increment; 
      if (camera_pitch > 360) {camera_pitch = 360;}
    } 
    else { camera_z = (camera_z + cameraIncrement); } 
    break;
  case 38: // Up arrow key -> -ve x-axis
    if (camera_flag) { 
      camera_pitch -= camera_angle_increment; 
      if (camera_pitch < 0) {camera_pitch = 0;}
    } 
    else { camera_z = (camera_z - cameraIncrement); } 
    break;
  case 39: // Right arrow key -> +ve y-axis
    if (camera_flag) { 
      camera_yaw -= camera_angle_increment; 
      if (camera_yaw < 0) {camera_yaw = 0;}
    } 
    else { camera_x = (camera_x + cameraIncrement); } 
    break;
  case 37: // Left arrow key -> -ve y-axis
    if (camera_flag) { 
      camera_yaw += camera_angle_increment; 
      if (camera_yaw > 360) {camera_yaw = 360;}
    } 
    else { camera_x = (camera_x - cameraIncrement); } 
    break;
  case 16: // Shift
    camera_y = (camera_y + cameraIncrement); 
    break;
  case 17: // Ctrl 
    camera_y = (camera_y - cameraIncrement); 
    break;
  case 49: 
    camera_flag = !camera_flag;
    break;

  // Lamp Controls
	case 87: // W key -> +ve x axis 
    lampLowerArmRotation = (lampLowerArmRotation + ANGLE_STEP) % 360;
    if (lampLowerArmRotation > 60) {lampLowerArmRotation = 60;}
	  break;
	case 83: // S key -> -ve x axis
    lampLowerArmRotation = (lampLowerArmRotation - ANGLE_STEP) % 360;
    if (lampLowerArmRotation < -60) {lampLowerArmRotation = -60;}
	  break;
  case 69: // E key -> +ve y axis
    lampBaseRotation = (lampBaseRotation + ANGLE_STEP) % 360;
	  break;
  case 81: // Q key -> -ve y axis
    lampBaseRotation = (lampBaseRotation - ANGLE_STEP) % 360;
    break;
  case 68: // D key -> +ve shift along x-Axis
    lampUpperArmRotation = (lampUpperArmRotation + ANGLE_STEP) % 360;
    if (lampUpperArmRotation > 135) {lampUpperArmRotation = 135;}
    break;
  case 65: // A key -> ive shift along x-Axis
    lampUpperArmRotation = (lampUpperArmRotation - ANGLE_STEP) % 360;
    if (lampUpperArmRotation < 0) {lampUpperArmRotation = 0;}
    break;

  // Cupboard controls
  case 79: // O key -> Opens cupboard doors
    shelfDoorAngle = (shelfDoorAngle + ANGLE_STEP) % 360;
    if (shelfDoorAngle > 225) { shelfDoorAngle = 225; } 
    break;
  case 80: // P key -> Closes cupboard doors
    shelfDoorAngle = (shelfDoorAngle - ANGLE_STEP) % 360;
    if (shelfDoorAngle < 0) { shelfDoorAngle = 0; } 
    break;
  
  // Drawer Controls
  case 75: // K Key
    drawerPulledOut = (drawerPulledOut + 5);
    if (drawerPulledOut > 100) { drawerPulledOut = 100; }
    break;
  case 76: // L Key
    drawerPulledOut = (drawerPulledOut - 5);
    if (drawerPulledOut < 0) { drawerPulledOut = 0; }
    break;
	default: return; // Skip drawing at no effective action
  }

  camera_lookAt_x = camera_x + Math.sin(camera_yaw * Math.PI / 180) * Math.sin(camera_pitch * Math.PI / 180);  // The x co-ordinate the eye is looking at
  camera_lookAt_y = camera_y + Math.cos(camera_pitch * Math.PI / 180);  // The y co-ordinate the eye is looking at
  camera_lookAt_z = camera_z + Math.cos(camera_yaw * Math.PI / 180) * Math.sin(camera_pitch * Math.PI / 180);  // The z co-ordinate the eye is looking at

  // Draw the scene
  draw(gl, u_ModelMatrix, u_NormalMatrix, u_isLighting);
}

function initVertexBuffers(u_ModelMatrix, u_NormalMatrix, u_ViewMatrix, u_ProjMatrix, u_UseTextures, u_Sampler, u_LightColor, u_LightPosition, u_AmbientLight) {
  // Create a cube
  //    v6----- v5
  //   /|      /|
  //  v1------v0|
  //  | |     | |
  //  | |v7---|-|v4
  //  |/      |/
  //  v2------v3
  var vertices = new Float32Array([   // Coordinates
    0.5, 0.5, 0.5,  -0.5, 0.5, 0.5,  -0.5,-0.5, 0.5,   0.5,-0.5, 0.5, // v0-v1-v2-v3 front
    0.5, 0.5, 0.5,   0.5,-0.5, 0.5,   0.5,-0.5,-0.5,   0.5, 0.5,-0.5, // v0-v3-v4-v5 right
    0.5, 0.5, 0.5,   0.5, 0.5,-0.5,  -0.5, 0.5,-0.5,  -0.5, 0.5, 0.5, // v0-v5-v6-v1 up
   -0.5, 0.5, 0.5,  -0.5, 0.5,-0.5,  -0.5,-0.5,-0.5,  -0.5,-0.5, 0.5, // v1-v6-v7-v2 left
   -0.5,-0.5,-0.5,   0.5,-0.5,-0.5,   0.5,-0.5, 0.5,  -0.5,-0.5, 0.5, // v7-v4-v3-v2 down
    0.5,-0.5,-0.5,  -0.5,-0.5,-0.5,  -0.5, 0.5,-0.5,   0.5, 0.5,-0.5  // v4-v7-v6-v5 back
   ]);
 
   var colors = new Float32Array([    // Colors
   1, 0, 0,   1, 0, 0,   1, 0, 0,  1, 0, 0,     // v0-v1-v2-v3 front
   1, 0, 0,   1, 0, 0,   1, 0, 0,  1, 0, 0,     // v0-v3-v4-v5 right
   1, 0, 0,   1, 0, 0,   1, 0, 0,  1, 0, 0,     // v0-v5-v6-v1 up
   1, 0, 0,   1, 0, 0,   1, 0, 0,  1, 0, 0,     // v1-v6-v7-v2 left
   1, 0, 0,   1, 0, 0,   1, 0, 0,  1, 0, 0,     // v7-v4-v3-v2 down
   1, 0, 0,   1, 0, 0,   1, 0, 0,  1, 0, 0　    // v4-v7-v6-v5 back
  ]);
 
   var normals = new Float32Array([    // Normal
   0.0, 0.0, 1.0,   0.0, 0.0, 1.0,   0.0, 0.0, 1.0,   0.0, 0.0, 1.0,  // v0-v1-v2-v3 front
   1.0, 0.0, 0.0,   1.0, 0.0, 0.0,   1.0, 0.0, 0.0,   1.0, 0.0, 0.0,  // v0-v3-v4-v5 right
   0.0, 1.0, 0.0,   0.0, 1.0, 0.0,   0.0, 1.0, 0.0,   0.0, 1.0, 0.0,  // v0-v5-v6-v1 up
    -1.0, 0.0, 0.0,  -1.0, 0.0, 0.0,  -1.0, 0.0, 0.0,  -1.0, 0.0, 0.0,  // v1-v6-v7-v2 left
   0.0,-1.0, 0.0,   0.0,-1.0, 0.0,   0.0,-1.0, 0.0,   0.0,-1.0, 0.0,  // v7-v4-v3-v2 down
   0.0, 0.0,-1.0,   0.0, 0.0,-1.0,   0.0, 0.0,-1.0,   0.0, 0.0,-1.0   // v4-v7-v6-v5 back
   ]);
 
   // Indices of the vertices
   var indices = new Uint8Array([
    0, 1, 2,   0, 2, 3,    // front
    4, 5, 6,   4, 6, 7,    // right
    8, 9,10,   8,10,11,    // up
   12,13,14,  12,14,15,    // left
   16,17,18,  16,18,19,    // down
   20,21,22,  20,22,23     // back
  ]);

 // Texture Coordinates
 var texCoords = new Float32Array([
   1.0, 1.0,    0.0, 1.0,   0.0, 0.0,   1.0, 0.0,  // v0-v1-v2-v3 front
   0.0, 1.0,    0.0, 0.0,   1.0, 0.0,   1.0, 1.0,  // v0-v3-v4-v5 right
   1.0, 0.0,    1.0, 1.0,   0.0, 1.0,   0.0, 0.0,  // v0-v5-v6-v1 up
   1.0, 1.0,    0.0, 1.0,   0.0, 0.0,   1.0, 0.0,  // v1-v6-v7-v2 left
   0.0, 0.0,    1.0, 0.0,   1.0, 1.0,   0.0, 1.0,  // v7-v4-v3-v2 down
   0.0, 0.0,    1.0, 0.0,   1.0, 1.0,   0.0, 1.0   // v4-v7-v6-v5 back
 ]);



  // Write the vertex property to buffers (coordinates, colors and normals)
  if (!initArrayBuffer(gl, 'a_Position', vertices, 3, gl.FLOAT)) return -1;
  if (!initArrayBuffer(gl, 'a_Color', colors, 3, gl.FLOAT)) return -1;
  if (!initArrayBuffer(gl, 'a_Normal', normals, 3, gl.FLOAT)) return -1;
  if (!initArrayBuffer(gl, 'a_TexCoords', texCoords, 2, gl.FLOAT)) return -1;

  // Write the indices to the buffer object
  var indexBuffer = gl.createBuffer();
  if (!indexBuffer) {
	console.log('Failed to create the buffer object');
	return false;
  }

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

  return indices.length;
}

function initArrayBuffer (gl, attribute, data, num, type) {
  // Create a buffer object
  var buffer = gl.createBuffer();
  if (!buffer) {
	console.log('Failed to create the buffer object');
	return false;
  }
  // Write date into the buffer object
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  // Assign the buffer object to the attribute variable
  var a_attribute = gl.getAttribLocation(gl.program, attribute);
  if (a_attribute < 0) {
	console.log('Failed to get the storage location of ' + attribute);
	return false;
  }
  gl.vertexAttribPointer(a_attribute, num, type, false, 0, 0);
  // Enable the assignment of the buffer object to the attribute variable
  gl.enableVertexAttribArray(a_attribute);

  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  return true;
}

var g_matrixStack = []; // Array for storing a matrix
function pushMatrix(m) { // Store the specified matrix to the array
  var m2 = new Matrix4(m);
  g_matrixStack.push(m2);
}

function popMatrix() { // Retrieve the matrix from the array
  return g_matrixStack.pop();
}

function drawbox(gl, u_ModelMatrix, u_NormalMatrix, n) {
  pushMatrix(modelMatrix);

	// Pass the model matrix to the uniform variable
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  gl.uniformMatrix4fv(u_ViewMatrix, false, viewMatrix.elements);

	// Calculate the normal transformation matrix and pass it to u_NormalMatrix
	g_normalMatrix.setInverseOf(modelMatrix);
	g_normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, g_normalMatrix.elements);

	// Draw the cube
	gl.drawElements(gl.TRIANGLES, n, gl.UNSIGNED_BYTE, 0);

  modelMatrix = popMatrix();
}

function loadTexture(texture, texIndex, texUnit, sampler) {
  // Flip image
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
  
  // Make active texture
  gl.activeTexture(texIndex)

  // Bind texture to image
  gl.bindTexture(gl.TEXTURE_2D, texture);

  // Set texture parameters 
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

  // Set image to texture
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture.image);

  // Pass the texure unit to the sampler
  gl.uniform1i(sampler, texUnit);   
}

function initTextures() {
  let texture_floor = gl.createTexture();
  texture_floor.image = new Image();
  texture_floor.image.src = '../resources/floor.jpg';
  texture_floor.image.onload = function() {
    loadTexture(texture_floor, gl.TEXTURE0, 0, u_sampler);
    texturesLoaded += 1;
  };

  let texture_cupboard = gl.createTexture();
  texture_cupboard.image = new Image();
  texture_cupboard.image.src = '../resources/cupboard.jpg';
  texture_cupboard.image.onload = function() {
    loadTexture(texture_cupboard, gl.TEXTURE1, 1, u_sampler);
    texturesLoaded += 1;
  };

  let texture_chair = gl.createTexture();
  texture_chair.image = new Image();
  texture_chair.image.src = '../resources/chair.jpg';
  texture_chair.image.onload = function() {
    loadTexture(texture_chair, gl.TEXTURE2, 2, u_sampler);
    texturesLoaded += 1;
  };

  let texture_sofa = gl.createTexture();
  texture_sofa.image = new Image();
  texture_sofa.image.src = '../resources/sofa.jpg';
  texture_sofa.image.onload = function() {
    loadTexture(texture_sofa, gl.TEXTURE3, 3, u_sampler);
    texturesLoaded += 1;
  };

  let texture_news = gl.createTexture();
  texture_news.image = new Image();
  texture_news.image.src = '../resources/news.jpg';
  texture_news.image.onload = function() {
    loadTexture(texture_news, gl.TEXTURE4, 4, u_sampler);
    texturesLoaded += 1;
  }

  let texture_oak = gl.createTexture();
  texture_oak.image = new Image();
  texture_oak.image.src = '../resources/oak.jpg';
  texture_oak.image.onload = function() {
    loadTexture(texture_oak, gl.TEXTURE5, 5, u_sampler);
    texturesLoaded += 1;
  }

  let texture_silver = gl.createTexture();
  texture_silver.image = new Image();
  texture_silver.image.src = '../resources/silver.jpg';
  texture_silver.image.onload = function() {
    loadTexture(texture_silver, gl.TEXTURE6, 6, u_sampler);
    texturesLoaded += 1;
  }

  let texture_wall = gl.createTexture();
  texture_wall.image = new Image();
  texture_wall.image.src = '../resources/wall.jpg';
  texture_wall.image.onload = function() {
    loadTexture(texture_wall, gl.TEXTURE7, 7, u_sampler);
    texturesLoaded += 1;
  }
}

function setNewTexture(sampler, texUnit) {
  // Pass the texure unit to the sampler
  gl.uniform1i(sampler, texUnit);   
}

function draw(gl, u_ModelMatrix, u_NormalMatrix, u_isLighting) {
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // Render virtual camera
  viewMatrix.setLookAt(camera_x, camera_y, camera_z, camera_lookAt_x, camera_lookAt_y, camera_lookAt_z, 0, 1, 0); // (Vector 1 = cam position), (Vector 2 = Position along direction to look at),  (Vector 3 = up Axis)

  gl.uniform1i(u_isLighting, true); // Will apply lighting

  // Set the vertex coordinates and color (for the cube)
  var n = initVertexBuffers(gl);
  if (n < 0) {
    console.log('Failed to set the vertex information');
    return;
  }

  // Rotate, and then translate
  modelMatrix.setTranslate(g_xOffset, 0, 0);  // Translation (No translation is supported here)
  modelMatrix.rotate(g_yAngle, 0, 1, 0); // Rotate along y axis
  modelMatrix.rotate(g_xAngle, 1, 0, 0); // Rotate along x axis


  /* =======================================
                Model the room
  ======================================= */ 

  {

  pushMatrix(modelMatrix);
    // Room coordinates relative to the origin 
    modelMatrix.translate(0, 0, 0); 
    modelMatrix.rotate(0, 1, 0, 0);

    // Room Variables
    wallHeight = 3;
    floorWidth = 8;
    floorLength = 6;
    floorDepth = 0.1;
    wallDepth = 0.1;

    setNewTexture(u_sampler, 7);

    // Model far wall
    pushMatrix(modelMatrix);
      modelMatrix.translate(0, (wallHeight / 2), -((floorLength / 2) - (wallDepth / 2)));  // Translation
      modelMatrix.scale(floorWidth, wallHeight, wallDepth); // Scale
      drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Model right wall
    pushMatrix(modelMatrix);
      modelMatrix.translate(((floorWidth / 2) - (wallDepth / 2)), (wallHeight / 2), 0.0);  // Translation
      modelMatrix.scale(wallDepth, wallHeight, floorLength); // Scale
      drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Model left wall
    pushMatrix(modelMatrix);
      modelMatrix.translate(-((floorWidth / 2) - (wallDepth / 2)), (wallHeight / 2), 0.0);  // Translation
      modelMatrix.scale(wallDepth, wallHeight, floorLength); // Scale
      drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    setNewTexture(u_sampler, 0);

    // Model the floor
    pushMatrix(modelMatrix);
      modelMatrix.translate(0, -(floorDepth / 2), 0);  // Translation
      modelMatrix.scale(floorWidth, floorDepth, floorLength); // Scale
      drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix(); 
  }

  setNewTexture(u_sampler, 1);

  /* =====================
      Model a bookshelf 
  ======================== */


  {
     
    pushMatrix(modelMatrix);
      // Bookshelf variables 
      shelfWidth = 1.6;
      shelfDepth = 0.6;
      shelfThickness = 0.1
      shelfHeight = 1.8;

      // Bookshelf coordinates relative to floor
      modelMatrix.translate(-((floorWidth / 2) - (shelfDepth / 2) - (shelfThickness / 2)), floorDepth  / 2, floorLength / 5); 

      // Bottom shelf 
      pushMatrix(modelMatrix);
        modelMatrix.scale(shelfDepth, shelfThickness, shelfWidth);
        drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
      modelMatrix = popMatrix();

      // Bottom middle shelf 
      pushMatrix(modelMatrix);
        modelMatrix.translate(0, (shelfHeight / 3), 0);
        modelMatrix.scale(shelfDepth, shelfThickness, shelfWidth);
        drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
      modelMatrix = popMatrix();

      // Top middle shelf 
      pushMatrix(modelMatrix);
        modelMatrix.translate(0, ((shelfHeight / 3) * 2), 0);
        modelMatrix.scale(shelfDepth, shelfThickness, shelfWidth);
        drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
      modelMatrix = popMatrix();

      // Top shelf 
      pushMatrix(modelMatrix);
        modelMatrix.translate(0, shelfHeight, 0);
        modelMatrix.scale(shelfDepth, shelfThickness, shelfWidth);
        drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
      modelMatrix = popMatrix();

      // Draw left side
      pushMatrix(modelMatrix);
        modelMatrix.translate(0, (shelfHeight / 2), -((shelfWidth / 2) - (shelfThickness / 2)));
        modelMatrix.scale(shelfDepth, shelfHeight, shelfThickness);
        drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
      modelMatrix = popMatrix();
      
      // Draw right side
      pushMatrix(modelMatrix);
        modelMatrix.translate(0, (shelfHeight / 2), ((shelfWidth / 2) - (shelfThickness / 2)));
        modelMatrix.scale(shelfDepth, shelfHeight, shelfThickness);
        drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
      modelMatrix = popMatrix();

      // Draw back
      pushMatrix(modelMatrix);
        modelMatrix.translate(-((shelfDepth / 2) - (shelfThickness / 2)), (shelfHeight / 2), 0);
        modelMatrix.scale(shelfThickness, shelfHeight, shelfWidth);
        drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
      modelMatrix = popMatrix();


      pushMatrix(modelMatrix);
        modelMatrix.translate((shelfDepth / 2), (shelfHeight / 2), (shelfWidth / 2))
        modelMatrix.rotate(-shelfDoorAngle, 0, 1, 0); // ANIMATION FOR LEFT DOOR 
        

        // Draw left door
        pushMatrix(modelMatrix);
          modelMatrix.translate(0, 0, -((shelfWidth / 4)));
          modelMatrix.scale(shelfThickness, shelfHeight + (shelfThickness), (shelfWidth / 2));
          drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
        modelMatrix = popMatrix();

        // Draw left door knob
        pushMatrix(modelMatrix);
          modelMatrix.translate(0, 0, -(shelfWidth / 3));
          modelMatrix.scale(shelfThickness * 2, shelfThickness * 2, shelfThickness * 2);
          drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
        modelMatrix = popMatrix();
      modelMatrix = popMatrix();

      pushMatrix(modelMatrix);
        modelMatrix.translate((shelfDepth / 2), (shelfHeight / 2), -(shelfWidth / 2))
        modelMatrix.rotate(shelfDoorAngle + 180, 0, 1, 0); // ANIMATION FOR RIGHT DOOR

        // Draw right door
        pushMatrix(modelMatrix);
          modelMatrix.translate(0, 0, -((shelfWidth / 4)));
          modelMatrix.scale(shelfThickness, shelfHeight + (shelfThickness), (shelfWidth / 2));
          drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
        modelMatrix = popMatrix();

        // Draw right door knob
        pushMatrix(modelMatrix);
          modelMatrix.translate(0, 0, -(shelfWidth / 3));
          modelMatrix.scale(shelfThickness * 2, shelfThickness * 2, shelfThickness * 2);
          drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
        modelMatrix = popMatrix();
      modelMatrix = popMatrix();


    modelMatrix = popMatrix();
    
  }
      
  /* =====================
		    Model a table 
  ======================== */

  {

    pushMatrix(modelMatrix); 
      // Table coordinates relative to the floor 
      modelMatrix.translate(-2.5, 0, -1.4); 
      
      // Table variables
      legHeight = 0.7;
      legWidth = 0.1;
      tableDepth = 0.05;
      tableLength = 1.8; 
      tableWidth = 1.0; 

      // Model table top
    
      pushMatrix(modelMatrix);
        modelMatrix.translate(0, legHeight + (tableDepth / 2), 0);  // Translation relative to table
        modelMatrix.scale(tableWidth, tableDepth, tableLength); // Scale
        drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
      modelMatrix = popMatrix(); 

      // Leg 1
      pushMatrix(modelMatrix);
        modelMatrix.translate(((tableWidth / 2) - (legWidth)), (legHeight / 2), ((tableLength / 2) - (legWidth)));  // Translation relative to table
        modelMatrix.scale(legWidth, legHeight, legWidth); // Scale
        drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
      modelMatrix = popMatrix(); 

      // Leg 2
      pushMatrix(modelMatrix);
        modelMatrix.translate(((tableWidth / 2) - (legWidth)), (legHeight / 2), -((tableLength / 2) - (legWidth)));  // Translation relative to table
        modelMatrix.scale(legWidth, legHeight, legWidth); // Scale
        drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
      modelMatrix = popMatrix(); 

      // Leg 3
      pushMatrix(modelMatrix);
        modelMatrix.translate(-((tableWidth / 2) - (legWidth)), (legHeight / 2), ((tableLength / 2) - (legWidth)));  // Translation relative to table
        modelMatrix.scale(legWidth, legHeight, legWidth); // Scale
        drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
      modelMatrix = popMatrix(); 

      // Leg 4
      pushMatrix(modelMatrix);
        modelMatrix.translate(-((tableWidth / 2) - (legWidth)), (legHeight / 2), -((tableLength / 2) - (legWidth)));  // Translation relative to table
        modelMatrix.scale(legWidth, legHeight, legWidth); // Scale
        drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
      modelMatrix = popMatrix(); 
    modelMatrix = popMatrix();
  }

    /* =====================
          Model a chair 
    ======================== */

    setNewTexture(u_sampler, 2);


  {

    pushMatrix(modelMatrix);
      // Chair coordinates relative to the floor 
      modelMatrix.translate(-2, 0, -1); 
      modelMatrix.rotate(270, 0, 1, 0);

      // Chair Variables 
      seatWidth = 0.5;
      seatDepth = 0.1; 
      legHeight = 0.4; 
      legWidth = 0.1;
      backHeight = 0.6; 

      // Draw seat
      pushMatrix(modelMatrix);
        modelMatrix.translate(0, legHeight + (seatDepth / 2), 0);  // Translation
        modelMatrix.scale(seatWidth, seatDepth, seatWidth); // Scale
        drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
      modelMatrix = popMatrix(); 

      // Draw legs
      pushMatrix(modelMatrix);
        modelMatrix.translate(-((seatWidth / 2) - (legWidth / 2)), (legHeight / 2), ((seatWidth / 2) - (legWidth / 2)));  // Translation
        modelMatrix.scale(legWidth, legHeight, legWidth); // Scale
        drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
      modelMatrix = popMatrix(); 

      pushMatrix(modelMatrix);
        modelMatrix.translate(-((seatWidth / 2) - (legWidth / 2)), (legHeight / 2), -((seatWidth / 2) - (legWidth / 2)));  // Translation
        modelMatrix.scale(legWidth, legHeight, legWidth); // Scale
        drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
      modelMatrix = popMatrix(); 

      pushMatrix(modelMatrix);
        modelMatrix.translate(((seatWidth / 2) - (legWidth / 2)), (legHeight / 2), ((seatWidth / 2) - (legWidth / 2)));  // Translation
        modelMatrix.scale(legWidth, legHeight, legWidth); // Scale
        drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
      modelMatrix = popMatrix(); 

      pushMatrix(modelMatrix);
        modelMatrix.translate(((seatWidth / 2) - (legWidth / 2)), (legHeight / 2), -((seatWidth / 2) - (legWidth / 2)));  // Translation
        modelMatrix.scale(legWidth, legHeight, legWidth); // Scale
        drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
      modelMatrix = popMatrix(); 

      // Draw back 
      pushMatrix(modelMatrix);
        modelMatrix.translate(0, (legHeight + (backHeight / 2) + (seatDepth)), -((seatWidth / 2) - (legWidth / 2)));  // Translation
        modelMatrix.scale(0.1, (backHeight), 0.1); // Scale
        drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
      modelMatrix = popMatrix(); 

      pushMatrix(modelMatrix);
        modelMatrix.translate(((seatWidth / 2) - (legWidth / 2)) , (legHeight + (backHeight / 2) + (seatDepth)), -((seatWidth / 2) - (legWidth / 2)));  // Translation
        modelMatrix.scale(0.1, (backHeight), 0.1); // Scale
        drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
      modelMatrix = popMatrix(); 

      pushMatrix(modelMatrix);
        modelMatrix.translate(-((seatWidth / 2) - (legWidth / 2)), (legHeight + (backHeight / 2) + (seatDepth)), -((seatWidth / 2) - (legWidth / 2)));  // Translation
        modelMatrix.scale(0.1, (backHeight), 0.1); // Scale
        drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
      modelMatrix = popMatrix(); 

      pushMatrix(modelMatrix);
        modelMatrix.translate(0, (legHeight + seatDepth + backHeight - (legWidth / 2)), - ((seatWidth / 2) - (legWidth / 2)));  // Translation
        modelMatrix.scale(seatWidth, legWidth, legWidth); // Scale
        drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
      modelMatrix = popMatrix(); 
    modelMatrix = popMatrix();
  
  }

    /* =====================
          Model a chair 
    ======================== */
  
  {

    pushMatrix(modelMatrix);
      // Chair coordinates relative to the floor 
      modelMatrix.translate(-2, 0, -1.8); 
      modelMatrix.rotate(270, 0, 1, 0);

      // Chair Variables 
      seatWidth = 0.5;
      seatDepth = 0.1; 
      legHeight = 0.4; 
      legWidth = 0.1;
      backHeight = 0.6; 

      // Draw seat
      pushMatrix(modelMatrix);
        modelMatrix.translate(0, legHeight + (seatDepth / 2), 0);  // Translation
        modelMatrix.scale(seatWidth, seatDepth, seatWidth); // Scale
        drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
      modelMatrix = popMatrix(); 

      // Draw legs
      pushMatrix(modelMatrix);
        modelMatrix.translate(-((seatWidth / 2) - (legWidth / 2)), (legHeight / 2), ((seatWidth / 2) - (legWidth / 2)));  // Translation
        modelMatrix.scale(legWidth, legHeight, legWidth); // Scale
        drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
      modelMatrix = popMatrix(); 

      pushMatrix(modelMatrix);
        modelMatrix.translate(-((seatWidth / 2) - (legWidth / 2)), (legHeight / 2), -((seatWidth / 2) - (legWidth / 2)));  // Translation
        modelMatrix.scale(legWidth, legHeight, legWidth); // Scale
        drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
      modelMatrix = popMatrix(); 

      pushMatrix(modelMatrix);
        modelMatrix.translate(((seatWidth / 2) - (legWidth / 2)), (legHeight / 2), ((seatWidth / 2) - (legWidth / 2)));  // Translation
        modelMatrix.scale(legWidth, legHeight, legWidth); // Scale
        drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
      modelMatrix = popMatrix(); 

      pushMatrix(modelMatrix);
        modelMatrix.translate(((seatWidth / 2) - (legWidth / 2)), (legHeight / 2), -((seatWidth / 2) - (legWidth / 2)));  // Translation
        modelMatrix.scale(legWidth, legHeight, legWidth); // Scale
        drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
      modelMatrix = popMatrix(); 

      // Draw back 
      pushMatrix(modelMatrix);
        modelMatrix.translate(0, (legHeight + (backHeight / 2) + (seatDepth)), -((seatWidth / 2) - (legWidth / 2)));  // Translation
        modelMatrix.scale(0.1, (backHeight), 0.1); // Scale
        drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
      modelMatrix = popMatrix(); 

      pushMatrix(modelMatrix);
        modelMatrix.translate(((seatWidth / 2) - (legWidth / 2)) , (legHeight + (backHeight / 2) + (seatDepth)), -((seatWidth / 2) - (legWidth / 2)));  // Translation
        modelMatrix.scale(0.1, (backHeight), 0.1); // Scale
        drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
      modelMatrix = popMatrix(); 

      pushMatrix(modelMatrix);
        modelMatrix.translate(-((seatWidth / 2) - (legWidth / 2)), (legHeight + (backHeight / 2) + (seatDepth)), -((seatWidth / 2) - (legWidth / 2)));  // Translation
        modelMatrix.scale(0.1, (backHeight), 0.1); // Scale
        drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
      modelMatrix = popMatrix(); 

      pushMatrix(modelMatrix);
        modelMatrix.translate(0, (legHeight + seatDepth + backHeight - (legWidth / 2)), - ((seatWidth / 2) - (legWidth / 2)));  // Translation
        modelMatrix.scale(seatWidth, legWidth, legWidth); // Scale
        drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
      modelMatrix = popMatrix(); 
    modelMatrix = popMatrix();
  
  }

    /* =====================
          Model a chair 
    ======================== */

  {

    pushMatrix(modelMatrix);
      // Chair coordinates relative to the floor 
      modelMatrix.translate(-3, 0, -1); 
      modelMatrix.rotate(90, 0, 1, 0);

      // Chair Variables 
      seatWidth = 0.5;
      seatDepth = 0.1; 
      legHeight = 0.4; 
      legWidth = 0.1;
      backHeight = 0.6; 

      // Draw seat
      pushMatrix(modelMatrix);
        modelMatrix.translate(0, legHeight + (seatDepth / 2), 0);  // Translation
        modelMatrix.scale(seatWidth, seatDepth, seatWidth); // Scale
        drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
      modelMatrix = popMatrix(); 

      // Draw legs
      pushMatrix(modelMatrix);
        modelMatrix.translate(-((seatWidth / 2) - (legWidth / 2)), (legHeight / 2), ((seatWidth / 2) - (legWidth / 2)));  // Translation
        modelMatrix.scale(legWidth, legHeight, legWidth); // Scale
        drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
      modelMatrix = popMatrix(); 

      pushMatrix(modelMatrix);
        modelMatrix.translate(-((seatWidth / 2) - (legWidth / 2)), (legHeight / 2), -((seatWidth / 2) - (legWidth / 2)));  // Translation
        modelMatrix.scale(legWidth, legHeight, legWidth); // Scale
        drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
      modelMatrix = popMatrix(); 

      pushMatrix(modelMatrix);
        modelMatrix.translate(((seatWidth / 2) - (legWidth / 2)), (legHeight / 2), ((seatWidth / 2) - (legWidth / 2)));  // Translation
        modelMatrix.scale(legWidth, legHeight, legWidth); // Scale
        drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
      modelMatrix = popMatrix(); 

      pushMatrix(modelMatrix);
        modelMatrix.translate(((seatWidth / 2) - (legWidth / 2)), (legHeight / 2), -((seatWidth / 2) - (legWidth / 2)));  // Translation
        modelMatrix.scale(legWidth, legHeight, legWidth); // Scale
        drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
      modelMatrix = popMatrix(); 

      // Draw back 
      pushMatrix(modelMatrix);
        modelMatrix.translate(0, (legHeight + (backHeight / 2) + (seatDepth)), -((seatWidth / 2) - (legWidth / 2)));  // Translation
        modelMatrix.scale(0.1, (backHeight), 0.1); // Scale
        drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
      modelMatrix = popMatrix(); 

      pushMatrix(modelMatrix);
        modelMatrix.translate(((seatWidth / 2) - (legWidth / 2)) , (legHeight + (backHeight / 2) + (seatDepth)), -((seatWidth / 2) - (legWidth / 2)));  // Translation
        modelMatrix.scale(0.1, (backHeight), 0.1); // Scale
        drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
      modelMatrix = popMatrix(); 

      pushMatrix(modelMatrix);
        modelMatrix.translate(-((seatWidth / 2) - (legWidth / 2)), (legHeight + (backHeight / 2) + (seatDepth)), -((seatWidth / 2) - (legWidth / 2)));  // Translation
        modelMatrix.scale(0.1, (backHeight), 0.1); // Scale
        drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
      modelMatrix = popMatrix(); 

      pushMatrix(modelMatrix);
        modelMatrix.translate(0, (legHeight + seatDepth + backHeight - (legWidth / 2)), - ((seatWidth / 2) - (legWidth / 2)));  // Translation
        modelMatrix.scale(seatWidth, legWidth, legWidth); // Scale
        drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
      modelMatrix = popMatrix(); 
    modelMatrix = popMatrix();
  
  }

    /* =====================
          Model a chair 
    ======================== */
  
  {

    pushMatrix(modelMatrix);
      // Chair coordinates relative to the floor 
      modelMatrix.translate(-3, 0, -1.8); 
      modelMatrix.rotate(90, 0, 1, 0);

      // Chair Variables 
      seatWidth = 0.5;
      seatDepth = 0.1; 
      legHeight = 0.4; 
      legWidth = 0.1;
      backHeight = 0.6; 

      // Draw seat
      pushMatrix(modelMatrix);
        modelMatrix.translate(0, legHeight + (seatDepth / 2), 0);  // Translation
        modelMatrix.scale(seatWidth, seatDepth, seatWidth); // Scale
        drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
      modelMatrix = popMatrix(); 

      // Draw legs
      pushMatrix(modelMatrix);
        modelMatrix.translate(-((seatWidth / 2) - (legWidth / 2)), (legHeight / 2), ((seatWidth / 2) - (legWidth / 2)));  // Translation
        modelMatrix.scale(legWidth, legHeight, legWidth); // Scale
        drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
      modelMatrix = popMatrix(); 

      pushMatrix(modelMatrix);
        modelMatrix.translate(-((seatWidth / 2) - (legWidth / 2)), (legHeight / 2), -((seatWidth / 2) - (legWidth / 2)));  // Translation
        modelMatrix.scale(legWidth, legHeight, legWidth); // Scale
        drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
      modelMatrix = popMatrix(); 

      pushMatrix(modelMatrix);
        modelMatrix.translate(((seatWidth / 2) - (legWidth / 2)), (legHeight / 2), ((seatWidth / 2) - (legWidth / 2)));  // Translation
        modelMatrix.scale(legWidth, legHeight, legWidth); // Scale
        drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
      modelMatrix = popMatrix(); 

      pushMatrix(modelMatrix);
        modelMatrix.translate(((seatWidth / 2) - (legWidth / 2)), (legHeight / 2), -((seatWidth / 2) - (legWidth / 2)));  // Translation
        modelMatrix.scale(legWidth, legHeight, legWidth); // Scale
        drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
      modelMatrix = popMatrix(); 

      // Draw back 
      pushMatrix(modelMatrix);
        modelMatrix.translate(0, (legHeight + (backHeight / 2) + (seatDepth)), -((seatWidth / 2) - (legWidth / 2)));  // Translation
        modelMatrix.scale(0.1, (backHeight), 0.1); // Scale
        drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
      modelMatrix = popMatrix(); 

      pushMatrix(modelMatrix);
        modelMatrix.translate(((seatWidth / 2) - (legWidth / 2)) , (legHeight + (backHeight / 2) + (seatDepth)), -((seatWidth / 2) - (legWidth / 2)));  // Translation
        modelMatrix.scale(0.1, (backHeight), 0.1); // Scale
        drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
      modelMatrix = popMatrix(); 

      pushMatrix(modelMatrix);
        modelMatrix.translate(-((seatWidth / 2) - (legWidth / 2)), (legHeight + (backHeight / 2) + (seatDepth)), -((seatWidth / 2) - (legWidth / 2)));  // Translation
        modelMatrix.scale(0.1, (backHeight), 0.1); // Scale
        drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
      modelMatrix = popMatrix(); 

      pushMatrix(modelMatrix);
        modelMatrix.translate(0, (legHeight + seatDepth + backHeight - (legWidth / 2)), - ((seatWidth / 2) - (legWidth / 2)));  // Translation
        modelMatrix.scale(seatWidth, legWidth, legWidth); // Scale
        drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
      modelMatrix = popMatrix(); 
    modelMatrix = popMatrix();
  
  }

    /* =====================
          Model TV Stand 
    ======================== */

    setNewTexture(u_sampler, 5);

  {
    pushMatrix(modelMatrix);
      standThickness = 0.1;
      standLength = 1.6;
      standWidth = 0.6;
      standHeight = 0.6;

      modelMatrix.translate(floorWidth / 2 - 1, standThickness /2, -(floorLength / 2 - 1)); 
      modelMatrix.rotate(-45, 0, 1, 0);

      // Base 
      pushMatrix(modelMatrix);
        modelMatrix.scale(standLength + (2 * standThickness), standThickness, standWidth + (2 * standThickness));
        drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
      modelMatrix = popMatrix();

      // Back of stand
      pushMatrix(modelMatrix);
        modelMatrix.translate(0, standHeight / 2, -((standWidth / 2) + (standThickness / 2)));
        modelMatrix.scale(standLength, standHeight - standThickness, standThickness);
        drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
      modelMatrix = popMatrix();

      // Left
      pushMatrix(modelMatrix);
        modelMatrix.translate(-((standLength / 2) + (standThickness / 2)), (standHeight / 2), 0);
        modelMatrix.scale(standThickness, standHeight - standThickness, standWidth + (2 * standThickness));
        drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
      modelMatrix = popMatrix();

      // Right 
      pushMatrix(modelMatrix);
        modelMatrix.translate(((standLength / 2) + (standThickness / 2)), (standHeight / 2), 0);
        modelMatrix.scale(standThickness, standHeight - standThickness, standWidth + (2 * standThickness));
        drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
      modelMatrix = popMatrix();

      // Top 
      pushMatrix(modelMatrix);
        modelMatrix.translate(0, standHeight, 0);
        modelMatrix.scale(standLength + (2 * standThickness), standThickness, standWidth + (2 * standThickness));
        drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
      modelMatrix = popMatrix();

      pushMatrix(modelMatrix)
        drawerThickness = 0.05;

        modelMatrix.translate(0, 0, (standWidth / 100) * drawerPulledOut); // Translate the drawer for animation 

        setNewTexture(u_sampler, 2);

        // Drawer base
        pushMatrix(modelMatrix);
          modelMatrix.translate(0, (standThickness - (drawerThickness)), 0);
          modelMatrix.scale(standLength, (drawerThickness), standWidth);
          drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
        modelMatrix = popMatrix();

        // Drawer left
        pushMatrix(modelMatrix);
          modelMatrix.translate(-((standLength / 2) - (drawerThickness / 2)), (standHeight / 2), 0);
          modelMatrix.scale(drawerThickness, standHeight - (drawerThickness * 2), standWidth);
          drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
        modelMatrix = popMatrix();

        // Drawer right 
        pushMatrix(modelMatrix);
          modelMatrix.translate(((standLength / 2) - (drawerThickness / 2)), (standHeight / 2), 0);
          modelMatrix.scale(drawerThickness, standHeight - (drawerThickness * 2), standWidth);
          drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
        modelMatrix = popMatrix();


        // Drawer front
        pushMatrix(modelMatrix);
          modelMatrix.translate(0, (standHeight / 2) , (standWidth / 2) + (standThickness / 2));
          modelMatrix.scale(standLength, standHeight - standThickness, standThickness)
          drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
        modelMatrix = popMatrix();

        setNewTexture(u_sampler, 5); // Set texture back

        // Drawer Handle 
        pushMatrix(modelMatrix);
          modelMatrix.translate(0, (standHeight / 2), (standWidth / 2) + (standThickness) + 0.1);
          modelMatrix.scale((standLength / 3) * 2, 0.1, 0.04);
          drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
        modelMatrix = popMatrix();

        pushMatrix(modelMatrix);
          modelMatrix.translate(-(standLength / 3), (standHeight / 2), (standWidth / 2) + (standThickness));
          modelMatrix.scale(0.04, 0.1, 0.1 + standThickness);
          drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
        modelMatrix = popMatrix();

        pushMatrix(modelMatrix);
          modelMatrix.translate((standLength / 3), (standHeight / 2), (standWidth / 2) + (standThickness));
          modelMatrix.scale(0.04, 0.1, 0.1 + standThickness);
          drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
        modelMatrix = popMatrix();
      modelMatrix = popMatrix() // Drawer

  }

      /* =====================
              Model TV  
      ======================== */

  {    
      setNewTexture(u_sampler, 6);

      pushMatrix(modelMatrix);
        tvHeight = 0.6;
        tvLength = (standLength / 3) * 2;
        tvThickness = 0.07;

        modelMatrix.translate(0, standHeight + standThickness, 0);

        // TV Base and stand
        pushMatrix(modelMatrix);
          modelMatrix.translate(0, -0.025, 0);
          modelMatrix.scale(0.4, 0.05, 0.2);
          drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
        modelMatrix = popMatrix();

        pushMatrix(modelMatrix);
          modelMatrix.translate(0, 0, 0);
          modelMatrix.scale(0.2, 0.2, 0.1);
          drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
        modelMatrix = popMatrix();

        // TV
        pushMatrix(modelMatrix);
          modelMatrix.translate(0, 0.1 + (tvHeight / 2), 0);
          modelMatrix.scale(tvLength, tvHeight, tvThickness);
          drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
        modelMatrix = popMatrix();

        // Set TV texture
        setNewTexture(u_sampler, 4);

        // TV Screen
        pushMatrix(modelMatrix);
          modelMatrix.translate(0, 0.1 + (tvHeight / 2), tvThickness/2);
          modelMatrix.scale(tvLength-0.05, tvHeight-0.05, 0.01);
          drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
        modelMatrix = popMatrix();

      modelMatrix = popMatrix();

    modelMatrix = popMatrix(); // tv stand
  }

    /* =====================
            Model Sofa  
    ======================== */
    setNewTexture(u_sampler, 3);

  {
    pushMatrix(modelMatrix);
      sofaThickness = 0.1;
      sofaLength = 2.0;
      sofaWidth = 0.6;
      sofaHeight = 1.0;

      modelMatrix.translate(1.5, 0, -0.5); 
      modelMatrix.rotate(135, 0, 1, 0);

      // Base 
      pushMatrix(modelMatrix);
        modelMatrix.scale(sofaLength + (2 * sofaThickness), sofaThickness, sofaWidth + (2 * sofaThickness));
        drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
      modelMatrix = popMatrix();

      // Back of sofa
      pushMatrix(modelMatrix);
        modelMatrix.translate(0, sofaHeight / 2, -((sofaWidth / 2) + (sofaThickness / 2)));
        modelMatrix.scale(sofaLength, sofaHeight - sofaThickness, sofaThickness);
        drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
      modelMatrix = popMatrix();

      // Left
      pushMatrix(modelMatrix);
        modelMatrix.translate(-((sofaLength / 2) + (sofaThickness / 2)), ((sofaHeight / 6) * 2), 0);
        modelMatrix.scale(sofaThickness, ((sofaHeight / 3) * 2) - sofaThickness, sofaWidth + (2 * sofaThickness));
        drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
      modelMatrix = popMatrix();

      // Right 
      pushMatrix(modelMatrix);
        modelMatrix.translate(((sofaLength / 2) + (sofaThickness / 2)), ((sofaHeight / 6) * 2), 0);
        modelMatrix.scale(sofaThickness, ((sofaHeight / 3) * 2) - sofaThickness, sofaWidth + (2 * sofaThickness));
        drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
      modelMatrix = popMatrix();

      // Cushions 
      pushMatrix(modelMatrix);
        modelMatrix.translate(0, (sofaHeight / 3) - sofaThickness, (sofaThickness / 2));
        modelMatrix.scale((sofaLength / 3)- (sofaThickness / 5), (sofaHeight / 3), sofaWidth);
        drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
      modelMatrix = popMatrix();

      pushMatrix(modelMatrix);
        modelMatrix.translate((sofaLength / 3), (sofaHeight / 3) - sofaThickness, (sofaThickness / 2));
        modelMatrix.scale((sofaLength / 3) - (sofaThickness / 5), (sofaHeight / 3), sofaWidth);
        drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
      modelMatrix = popMatrix();

      pushMatrix(modelMatrix);
        modelMatrix.translate(-(sofaLength / 3), (sofaHeight / 3) - sofaThickness, (sofaThickness / 2));
        modelMatrix.scale((sofaLength / 3) - (sofaThickness / 5), (sofaHeight / 3), sofaWidth);
        drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
      modelMatrix = popMatrix();
    modelMatrix = popMatrix(); // Sofa
  }
    /* =====================
        Model little table  
    ======================== */
    setNewTexture(u_sampler, 1);

  {
    // Table coordinates relative to the floor 
    pushMatrix(modelMatrix);
      modelMatrix.translate(2.7, 0, 0.7); 
      modelMatrix.rotate(45, 0, 1, 0);
        
      // Table variables
      legHeight = 0.5;
      legWidth = 0.1;
      tableDepth = 0.05;
      tableLength = 0.6; 
      tableWidth = 0.6; 

      // Model table top
    
      pushMatrix(modelMatrix);
        modelMatrix.translate(0, legHeight + (tableDepth / 2), 0);  // Translation relative to table
        modelMatrix.scale(tableWidth, tableDepth, tableLength); // Scale
        drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
      modelMatrix = popMatrix(); 

      // Leg 1
      pushMatrix(modelMatrix);
        modelMatrix.translate(((tableWidth / 2) - (legWidth)), (legHeight / 2), ((tableLength / 2) - (legWidth)));  // Translation relative to table
        modelMatrix.scale(legWidth, legHeight, legWidth); // Scale
        drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
      modelMatrix = popMatrix(); 

      // Leg 2
      pushMatrix(modelMatrix);
        modelMatrix.translate(((tableWidth / 2) - (legWidth)), (legHeight / 2), -((tableLength / 2) - (legWidth)));  // Translation relative to table
        modelMatrix.scale(legWidth, legHeight, legWidth); // Scale
        drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
      modelMatrix = popMatrix(); 

      // Leg 3
      pushMatrix(modelMatrix);
        modelMatrix.translate(-((tableWidth / 2) - (legWidth)), (legHeight / 2), ((tableLength / 2) - (legWidth)));  // Translation relative to table
        modelMatrix.scale(legWidth, legHeight, legWidth); // Scale
        drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
      modelMatrix = popMatrix(); 

      // Leg 4
      pushMatrix(modelMatrix);
        modelMatrix.translate(-((tableWidth / 2) - (legWidth)), (legHeight / 2), -((tableLength / 2) - (legWidth)));  // Translation relative to table
        modelMatrix.scale(legWidth, legHeight, legWidth); // Scale
        drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
      modelMatrix = popMatrix(); 
  }
      /* =====================
              Model Lamp  
      ======================== */

      setNewTexture(u_sampler, 6);
  {
      pushMatrix(modelMatrix);
        lampBaseWidth = 0.25;
        lampBaseDepth = 0.05;
        lampArmWidth = 0.05;
        lampLowerArmLength = 0.4;
        lampUpperArmLength = 0.3;

        modelMatrix.translate(0, legHeight - tableDepth + (lampBaseWidth / 2), 0);
        modelMatrix.rotate(lampBaseRotation, 0, 1, 0);

        // Base
        pushMatrix(modelMatrix);
          modelMatrix.scale(lampBaseWidth, lampBaseDepth, lampBaseWidth); 
          drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
        modelMatrix = popMatrix();
        
        // Lower Arm
        modelMatrix.rotate(lampLowerArmRotation, 0, 0, 1);
        modelMatrix.translate(0, (lampLowerArmLength / 2), 0)
        pushMatrix(modelMatrix);
          modelMatrix.scale(lampArmWidth, lampLowerArmLength, lampArmWidth);
          drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
        modelMatrix = popMatrix();

        // Upper arm

        modelMatrix.translate(0.0, lampLowerArmLength / 2, 0);
        modelMatrix.rotate(lampUpperArmRotation, 0, 0, 1);
        modelMatrix.translate(0.0, lampUpperArmLength / 2, 0);
        modelMatrix.scale(lampArmWidth, lampUpperArmLength, lampArmWidth);
        drawbox(gl, u_ModelMatrix, u_NormalMatrix, n);
  }
      modelMatrix = popMatrix() // End of lamp
    modelMatrix = popMatrix(); // End of small table
  modelMatrix = popMatrix(); // floor
}
