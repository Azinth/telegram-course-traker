const input = `Clique aqui para ver o Menu. Utilize as # para saltar entre os vídeos.

= Módulo 01 - Boas vindas
#D001

= Módulo 02 - Rotas e HTTP, Criando API REST com Node.js
#D002 #D003 #D004 #D005 #D006 #D007 #D008 #D009 #D010 #D011 #D012 #D013 #D014 #D015 #D016 #D017 #D018 #D019 #D020 #D021 #D022 #D023 #D024 #D025 #D026 #D027 #D028 #D029 #D030 #D031

= Módulo 03 - Implementando o SOLID, API Node.js com SOLID
#D032 #D033 #D034 #D035 #D036 #D037 #D038 #D039 #D040 #D041 #D042 #D043 #D044 #D045 #D046 #D047 #D048 #D049 #D050 #D051 #D052 #D053 #D054 #D055 #D056 #D057 #D058 #D059 #D060 #D061 #D062 #D063 #D064 #D065 #D066 #D067 #D068 #D069 #D070 #D071 #D072 #D073 #D074 #D075 #D076 #D077 #D078 #D079 #D080 #D081 #D082 #D083 #D084 #D085 #D086 #D087 #D088 #D089 #D090 #D091 #D092 #D093 #D094 #D095 #D096

= Módulo 04 - DDD e Primeiro framework no NodeJS
#D097 #D098 #D099 #D100 #D101 #D102 #D103 #D104 #D105 #D106 #D107 #D108 #D109 #D110 #D111 #D112 #D113 #D114 #D115 #D116 #D117 #D118 #D119 #D120 #D121 #D122 #D123 #D124 #D125 #D126 #D127 #D128 #D129 #D130 #D131 #D132 #D133 #D134 #D135 #D136 #D137 #D138 #D139 #D140 #D141 #D142 #D143 #D144 #D145 #D146 #D147 #D148 #D149 #D150 #D151 #D152 #D153 #D154 #D155 #D156 #D157

= Módulo 05 - NestJS
#D158 #D159 #D160 #D161 #D162 #D163 #D164 #D165 #D166 #D167 #D168 #D169 #D170 #D171 #D172 #D173 #D174 #D175 #D176 #D177 #D178 #D179 #D180 #D181 #D182 #D183 #D184 #D185 #D186 #D187 #D188 #D189 #D190 #D191 #D192 #D193 #D194 #D195 #D196 #D197 #D198 #D199 #D200 #D201 #D202 #D203 #D204 #D205 #D206 #D207 #D208 #D209 #D210 #D211 #D212 #D213 #D214 #D215 #D216 #D217 #D218 #D219 #D220 #D221 #D222 #D223 #D224 #D225 #D226 #D227 #D228 #D229 #D230 #D231 #D232 #D233 #D234 #D235 #D236 #D237 #D238 #D239 #D240 #D241 #D242 #D243 #D244 #D245 #D246 #D247

-
Via @D_er_Academy`;

const TAG_REGEX = /#[A-Za-z]+\d+/g;
const lines = input
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter(Boolean);
const modules = [];
let current = null;
for (const line of lines) {
  if (line.startsWith("=")) {
    if (current) modules.push(current);
    current = { title: line.replace(/^=\s*/, ""), tags: [] };
  } else {
    const tags = line.match(TAG_REGEX) || [];
    if (tags.length) {
      if (!current) current = { title: "Sem Título", tags: [] };
      current.tags.push(...tags);
    }
  }
}
if (current) modules.push(current);
console.log("modules count:", modules.length);
console.log("first module tags:", modules[0]?.tags.slice(0, 10));
console.log("total tags:", modules.flatMap((m) => m.tags).length);
console.log(
  "unique tags:",
  [...new Set(modules.flatMap((m) => m.tags))].length,
);
console.log("sample tags:", modules.flatMap((m) => m.tags).slice(0, 20));
