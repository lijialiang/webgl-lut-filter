
(function(l, i, v, e) { v = l.createElement(i); v.async = 1; v.src = '//' + (location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; e = l.getElementsByTagName(i)[0]; e.parentNode.insertBefore(v, e)})(document, 'script');
(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global = global || self, global.lutFilter = factory());
}(this, function () { 'use strict';

  function createWebglProgram(gl, shaderObjects) {
    const shaders = [];

    for (var i = 0; i < shaderObjects.length; ++i) {
      let { type, text } = shaderObjects[i];

      if (type === 'x-shader/x-vertex') {
        type = gl.VERTEX_SHADER;
      } else if (type === 'x-shader/x-fragment') {
        type = gl.FRAGMENT_SHADER;
      }

      const shader = gl.createShader(type);

      gl.shaderSource(shader, text);
      gl.compileShader(shader);
      gl.getShaderParameter(shader, gl.COMPILE_STATUS);

      shaders.push(shader);
    }

    const program = gl.createProgram();

    shaders.forEach(shader => gl.attachShader(program, shader));

    gl.linkProgram(program);

    return program
  }

  const vertexShader = {
    type: 'x-shader/x-vertex',
    text: `
attribute vec2 a_position;
attribute vec2 a_texCoord;

uniform vec2 u_resolution;
varying vec2 v_texCoord;

void main() {
  vec2 zeroToOne = a_position / u_resolution;
  vec2 zeroToTwo = zeroToOne * 2.0;
  vec2 clipSpace = zeroToTwo - 1.0;
  gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
  v_texCoord = a_texCoord;
}
`
  };

  const fragmentShader = {
    type: 'x-shader/x-fragment',
    text: `
precision mediump float;

varying lowp vec2 v_texCoord;

uniform sampler2D u_image0;
uniform sampler2D u_image1; // lookup texture

void main()
{
  vec4 textureColor = texture2D(u_image0, v_texCoord);

  float blueColor = textureColor.b * 63.0;

  vec2 quad1;
  quad1.y = floor(floor(blueColor) / 8.0);
  quad1.x = floor(blueColor) - (quad1.y * 8.0);

  vec2 quad2;
  quad2.y = floor(ceil(blueColor) / 8.0);
  quad2.x = ceil(blueColor) - (quad2.y * 8.0);

  vec2 texPos1;
  texPos1.x = (quad1.x * 0.125) + 0.5/512.0 + ((0.125 - 1.0/512.0) * textureColor.r);
  texPos1.y = (quad1.y * 0.125) + 0.5/512.0 + ((0.125 - 1.0/512.0) * textureColor.g);

  vec2 texPos2;
  texPos2.x = (quad2.x * 0.125) + 0.5/512.0 + ((0.125 - 1.0/512.0) * textureColor.r);
  texPos2.y = (quad2.y * 0.125) + 0.5/512.0 + ((0.125 - 1.0/512.0) * textureColor.g);

  lowp vec4 newColor1 = texture2D(u_image1, texPos1);
  lowp vec4 newColor2 = texture2D(u_image1, texPos2);

  lowp vec4 newColor = mix(newColor1, newColor2, fract(blueColor));

  gl_FragColor = mix(textureColor, vec4(newColor.rgb, textureColor.w), 1.0);
}
`
  };

  function lutFilter ({ canvas, filterImage, image }) {
    const gl = canvas.getContext('webgl');
    const program = createWebglProgram(gl, [vertexShader, fragmentShader]);

    const positionLocation = gl.getAttribLocation(program, 'a_position');
    const texcoordLocation = gl.getAttribLocation(program, 'a_texCoord');

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

    const texcoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texcoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        0.0,  0.0,
        1.0,  0.0,
        0.0,  1.0,
        0.0,  1.0,
        1.0,  0.0,
        1.0,  1.0,
    ]), gl.STATIC_DRAW);

    const resolutionLocation = gl.getUniformLocation(program, 'u_resolution');
    const u_image0Location = gl.getUniformLocation(program, 'u_image0');
    const u_image1Location = gl.getUniformLocation(program, 'u_image1');

    canvas.width = image.width;
    canvas.height = image.height;

    const image_texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, image_texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

    const filterImage_texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, filterImage_texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, filterImage);

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
       0, 0,
       canvas.width, 0,
       0, canvas.height,
       0, canvas.height,
       canvas.width, 0,
       canvas.width, canvas.height,
    ]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(positionLocation);

    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    gl.enableVertexAttribArray(texcoordLocation);

    gl.bindBuffer(gl.ARRAY_BUFFER, texcoordBuffer);
    gl.vertexAttribPointer(texcoordLocation, 2, gl.FLOAT, false, 0, 0);

    gl.uniform2f(resolutionLocation, gl.canvas.width, gl.canvas.height);

    gl.uniform1i(u_image0Location, 0);
    gl.uniform1i(u_image1Location, 1);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, image_texture);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, filterImage_texture);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  return lutFilter;

}));
//# sourceMappingURL=main.js.map
