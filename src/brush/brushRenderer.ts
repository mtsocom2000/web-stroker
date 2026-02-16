import type { BrushSettings } from './presets';
import type { StampRenderData } from './stampRenderer';

const VERTEX_SHADER = `#version 300 es
precision highp float;

in vec2 a_position;
in vec2 a_offset;
in float a_radius;
in float a_opacity;

uniform vec2 u_resolution;
uniform float u_scale;

out vec2 v_uv;
out float v_opacity;
out float v_radius;

void main() {
  v_uv = a_position;
  v_opacity = a_opacity;
  v_radius = a_radius;

  vec2 pos = a_offset + a_position * a_radius * u_scale;
  
  vec2 clipSpace = (pos / u_resolution) * 2.0 - 1.0;
  clipSpace.y *= -1.0;
  
  gl_Position = vec4(clipSpace, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 v_uv;
in float v_opacity;
in float v_radius;

uniform float u_hardness;
uniform vec3 u_color;

out vec4 fragColor;

void main() {
  float dist = length(v_uv);
  
  float alpha;
  if (u_hardness >= 1.0) {
    alpha = dist <= 1.0 ? v_opacity : 0.0;
  } else if (u_hardness <= 0.0) {
    alpha = v_opacity * (1.0 - dist * dist);
  } else {
    float edge = 1.0 - u_hardness;
    alpha = smoothstep(1.0, 1.0 - edge, dist) * v_opacity;
  }
  
  fragColor = vec4(u_color, alpha);
}
`;

export class BrushRenderer {
  private gl: WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private instanceBuffer: WebGLBuffer | null = null;
  private maxInstances = 10000;
  private instanceData: Float32Array;

  private positionBuffer: WebGLBuffer | null = null;
  private positionData: Float32Array;

  constructor() {
    this.positionData = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
      -1,  1,
       1, -1,
       1,  1,
    ]);
    this.instanceData = new Float32Array(this.maxInstances * 4);
  }

  initialize(canvas: HTMLCanvasElement): boolean {
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: false,
    });

    if (!gl) {
      console.error('WebGL2 not supported');
      return false;
    }

    this.gl = gl;

    const vs = this.compileShader(gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = this.compileShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);

    if (!vs || !fs) return false;

    const program = gl.createProgram();
    if (!program) return false;

    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program));
      return false;
    }

    this.program = program;

    this.setupBuffers(gl);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    console.log('BrushRenderer initialized successfully');
    return true;
  }

  private compileShader(type: number, source: string): WebGLShader | null {
    if (!this.gl) return null;

    const shader = this.gl.createShader(type);
    if (!shader) return null;

    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.error('Brush shader compile error:', this.gl.getShaderInfoLog(shader));
      this.gl.deleteShader(shader);
      return null;
    }

    return shader;
  }

  private setupBuffers(gl: WebGL2RenderingContext): void {
    const vao = gl.createVertexArray();
    if (!vao) return;
    this.vao = vao;
    gl.bindVertexArray(vao);

    const posBuffer = gl.createBuffer();
    if (!posBuffer) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.positionData, gl.STATIC_DRAW);

    const posLoc = gl.getAttribLocation(this.program!, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const instBuffer = gl.createBuffer();
    if (!instBuffer) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, instBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.instanceData.byteLength, gl.DYNAMIC_DRAW);

    const offsetLoc = gl.getAttribLocation(this.program!, 'a_offset');
    gl.enableVertexAttribArray(offsetLoc);
    gl.vertexAttribPointer(offsetLoc, 2, gl.FLOAT, false, 16, 0);
    gl.vertexAttribDivisor(offsetLoc, 1);

    const radiusLoc = gl.getAttribLocation(this.program!, 'a_radius');
    gl.enableVertexAttribArray(radiusLoc);
    gl.vertexAttribPointer(radiusLoc, 1, gl.FLOAT, false, 16, 8);
    gl.vertexAttribDivisor(radiusLoc, 1);

    const opacityLoc = gl.getAttribLocation(this.program!, 'a_opacity');
    gl.enableVertexAttribArray(opacityLoc);
    gl.vertexAttribPointer(opacityLoc, 1, gl.FLOAT, false, 16, 12);
    gl.vertexAttribDivisor(opacityLoc, 1);

    this.instanceBuffer = instBuffer;
    gl.bindVertexArray(null);
  }

  render(
    stampData: StampRenderData,
    brushSettings: BrushSettings,
    color: string,
    width: number,
    height: number,
    scale: number = 1
  ): void {
    if (!this.gl || !this.program || !this.vao || !this.instanceBuffer) return;

    const stamps = stampData.stamps;
    if (stamps.length === 0) return;

    const count = Math.min(stamps.length, this.maxInstances);

    for (let i = 0; i < count; i++) {
      const stamp = stamps[i];
      const offset = i * 4;
      this.instanceData[offset] = stamp.x;
      this.instanceData[offset + 1] = stamp.y;
      this.instanceData[offset + 2] = stamp.radius;
      this.instanceData[offset + 3] = stamp.opacity;
    }

    const gl = this.gl;

    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.instanceData.subarray(0, count * 4));

    const rgb = this.hexToRgb(color);

    gl.useProgram(this.program);

    gl.uniform2f(
      gl.getUniformLocation(this.program!, 'u_resolution'),
      width,
      height
    );
    gl.uniform1f(gl.getUniformLocation(this.program!, 'u_scale'), scale);
    gl.uniform1f(gl.getUniformLocation(this.program!, 'u_hardness'), brushSettings.hardness);
    gl.uniform3f(gl.getUniformLocation(this.program!, 'u_color'), rgb.r, rgb.g, rgb.b);

    gl.bindVertexArray(this.vao);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, count);
    gl.bindVertexArray(null);
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return { r: 0, g: 0, b: 0 };
    return {
      r: parseInt(result[1], 16) / 255,
      g: parseInt(result[2], 16) / 255,
      b: parseInt(result[3], 16) / 255,
    };
  }

  clear(): void {
    if (!this.gl) return;
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
  }

  destroy(): void {
    if (this.gl && this.vao) this.gl.deleteVertexArray(this.vao);
    if (this.gl && this.instanceBuffer) this.gl.deleteBuffer(this.instanceBuffer);
    if (this.gl && this.positionBuffer) this.gl.deleteBuffer(this.positionBuffer);
    if (this.gl && this.program) this.gl.deleteProgram(this.program);
  }
}
