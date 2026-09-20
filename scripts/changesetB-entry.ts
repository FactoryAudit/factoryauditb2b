// CHANGE SET B 夹具测试入口（esbuild 打包用，**仅测试用，不进产物**）
//
// 只 re-export，不含逻辑 —— 让 esbuild 把「真实源码」打进来（而不是复制一份逻辑），
// 这样断言的才是线上真正跑的那段代码。
export {
  countSuppliersByClusterSlugs,
  listSuppliersByClusterSlug,
} from "../lib/queries";
export {
  listPublishedClusters,
  getPublishedClusterBySlug,
} from "../lib/industrialClusters";
