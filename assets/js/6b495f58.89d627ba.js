"use strict";(self.webpackChunkdocs=self.webpackChunkdocs||[]).push([[956],{7263:(e,t,n)=>{n.r(t),n.d(t,{assets:()=>s,contentTitle:()=>a,default:()=>d,frontMatter:()=>o,metadata:()=>l,toc:()=>c});var r=n(4848),i=n(8453);const o={title:"Client",sidebar_label:"Client"},a=void 0,l={id:"client",title:"Client",description:"Perform a query",source:"@site/docs/client.md",sourceDirName:".",slug:"/client",permalink:"/graphql-client/client",draft:!1,unlisted:!1,editUrl:"https://github.com/swan-io/graphql-client/edit/main/docs/docs/client.md",tags:[],version:"current",frontMatter:{title:"Client",sidebar_label:"Client"},sidebar:"docs",previous:{title:"useMutation",permalink:"/graphql-client/use-mutation"},next:{title:"Pagination",permalink:"/graphql-client/pagination"}},s={},c=[{value:"Perform a query",id:"perform-a-query",level:2},{value:"Perform a mutation",id:"perform-a-mutation",level:2}];function u(e){const t={code:"code",h2:"h2",pre:"pre",...(0,i.R)(),...e.components};return(0,r.jsxs)(r.Fragment,{children:[(0,r.jsx)(t.h2,{id:"perform-a-query",children:"Perform a query"}),"\n",(0,r.jsx)(t.pre,{children:(0,r.jsx)(t.code,{className:"language-ts",children:"client.query(query, variables).tap((result) => {\n  console.log(result);\n});\n"})}),"\n",(0,r.jsx)(t.h2,{id:"perform-a-mutation",children:"Perform a mutation"}),"\n",(0,r.jsx)(t.pre,{children:(0,r.jsx)(t.code,{className:"language-ts",children:"client.commitMutation(mutation, variables).tap((result) => {\n  console.log(result);\n});\n"})})]})}function d(e={}){const{wrapper:t}={...(0,i.R)(),...e.components};return t?(0,r.jsx)(t,{...e,children:(0,r.jsx)(u,{...e})}):u(e)}},8453:(e,t,n)=>{n.d(t,{R:()=>a,x:()=>l});var r=n(6540);const i={},o=r.createContext(i);function a(e){const t=r.useContext(o);return r.useMemo((function(){return"function"==typeof e?e(t):{...t,...e}}),[t,e])}function l(e){let t;return t=e.disableParentContext?"function"==typeof e.components?e.components(i):e.components||i:a(e.components),r.createElement(o.Provider,{value:t},e.children)}}}]);