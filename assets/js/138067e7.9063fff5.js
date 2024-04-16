"use strict";(self.webpackChunkdocs=self.webpackChunkdocs||[]).push([[682],{3392:(e,r,n)=>{n.r(r),n.d(r,{assets:()=>l,contentTitle:()=>d,default:()=>a,frontMatter:()=>t,metadata:()=>i,toc:()=>c});var s=n(4848),u=n(8453);const t={title:"useDeferredQuery",sidebar_label:"useDeferredQuery"},d=void 0,i={id:"use-deferred-query",title:"useDeferredQuery",description:"useDeferredQuery(query, config?)",source:"@site/docs/use-deferred-query.md",sourceDirName:".",slug:"/use-deferred-query",permalink:"/graphql-client/use-deferred-query",draft:!1,unlisted:!1,editUrl:"https://github.com/swan-io/graphql-client/edit/main/docs/docs/use-deferred-query.md",tags:[],version:"current",frontMatter:{title:"useDeferredQuery",sidebar_label:"useDeferredQuery"},sidebar:"docs",previous:{title:"useQuery",permalink:"/graphql-client/use-query"},next:{title:"useMutation",permalink:"/graphql-client/use-mutation"}},l={},c=[{value:"useDeferredQuery(query, config?)",id:"usedeferredqueryquery-config",level:2},{value:"Params",id:"params",level:3},{value:"Returns",id:"returns",level:3},{value:"Example",id:"example",level:2}];function o(e){const r={a:"a",code:"code",h2:"h2",h3:"h3",li:"li",p:"p",pre:"pre",ul:"ul",...(0,u.R)(),...e.components};return(0,s.jsxs)(s.Fragment,{children:[(0,s.jsx)(r.h2,{id:"usedeferredqueryquery-config",children:"useDeferredQuery(query, config?)"}),"\n",(0,s.jsxs)(r.p,{children:["Similar to ",(0,s.jsx)(r.a,{href:"./use-query",children:(0,s.jsx)(r.code,{children:"useQuery"})}),", but requires a manual call to ",(0,s.jsx)(r.code,{children:"query"}),"."]}),"\n",(0,s.jsx)(r.h3,{id:"params",children:"Params"}),"\n",(0,s.jsxs)(r.ul,{children:["\n",(0,s.jsxs)(r.li,{children:[(0,s.jsx)(r.code,{children:"query"}),": your query document node"]}),"\n",(0,s.jsxs)(r.li,{children:[(0,s.jsx)(r.code,{children:"config"})," (optional)","\n",(0,s.jsxs)(r.ul,{children:["\n",(0,s.jsxs)(r.li,{children:[(0,s.jsx)(r.code,{children:"optimize"}),": adapt query to only require data that's missing from the cache (default: ",(0,s.jsx)(r.code,{children:"false"}),")"]}),"\n"]}),"\n"]}),"\n"]}),"\n",(0,s.jsx)(r.h3,{id:"returns",children:"Returns"}),"\n",(0,s.jsxs)(r.p,{children:["This hook returns a tuple you can extract like a ",(0,s.jsx)(r.code,{children:"useState"}),":"]}),"\n",(0,s.jsx)(r.pre,{children:(0,s.jsx)(r.code,{className:"language-ts",children:"const [data, query] = useDeferredQuery(...)\n"})}),"\n",(0,s.jsxs)(r.ul,{children:["\n",(0,s.jsxs)(r.li,{children:[(0,s.jsx)(r.code,{children:"data"})," (",(0,s.jsx)(r.code,{children:"AsyncData<Result<Data, ClientError>>"}),"): the GraphQL response"]}),"\n",(0,s.jsxs)(r.li,{children:[(0,s.jsx)(r.code,{children:"query(variables, ?config)"}),": runs the query","\n",(0,s.jsxs)(r.ul,{children:["\n",(0,s.jsxs)(r.li,{children:[(0,s.jsx)(r.code,{children:"config"})," (optional)","\n",(0,s.jsxs)(r.ul,{children:["\n",(0,s.jsxs)(r.li,{children:[(0,s.jsx)(r.code,{children:"overrides"}),": custom request configuration (",(0,s.jsx)(r.code,{children:"url"}),", ",(0,s.jsx)(r.code,{children:"headers"})," and/or ",(0,s.jsx)(r.code,{children:"withCredentials"}),")"]}),"\n"]}),"\n"]}),"\n"]}),"\n"]}),"\n"]}),"\n",(0,s.jsx)(r.h2,{id:"example",children:"Example"}),"\n",(0,s.jsx)(r.pre,{children:(0,s.jsx)(r.code,{className:"language-ts",children:'import { useDeferredQuery } from "@swan-io/graphql-client";\n// ...\n\nconst userPageQuery = graphql(`\n  query UserPage($userId: ID!) {\n    user(id: $userId) {\n      id\n      username\n      avatar\n    }\n  }\n`);\n\ntype Props = {\n  userId: string;\n};\n\nconst UserPage = ({ userId }: Props) => {\n  const [user, queryUser] = useDeferredQuery(userPageQuery);\n\n  useEffect(() => {\n    const request = queryUser({ userId })\n    return () => request.cancel()\n  }, [userId, queryUser])\n\n  return user.match({\n    NotAsked: () => null,\n    Loading: () => <LoadingIndicator />,\n    Done: (result) =>\n      result.match({\n        Error: (error) => <ErrorIndicator error={error} />,\n        Ok: (user) => <UserDetails user={user} />,\n      }),\n  });\n};\n'})})]})}function a(e={}){const{wrapper:r}={...(0,u.R)(),...e.components};return r?(0,s.jsx)(r,{...e,children:(0,s.jsx)(o,{...e})}):o(e)}},8453:(e,r,n)=>{n.d(r,{R:()=>d,x:()=>i});var s=n(6540);const u={},t=s.createContext(u);function d(e){const r=s.useContext(t);return s.useMemo((function(){return"function"==typeof e?e(r):{...r,...e}}),[r,e])}function i(e){let r;return r=e.disableParentContext?"function"==typeof e.components?e.components(u):e.components||u:d(e.components),s.createElement(t.Provider,{value:r},e.children)}}}]);