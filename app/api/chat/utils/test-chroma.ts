import { getCollectionInfo } from './chroma';
import { testEmbeddingFunction } from './chroma';



async function checkDatabase() {
  const info = await getCollectionInfo();
  console.log(info);
}

checkDatabase();
testEmbeddingFunction();