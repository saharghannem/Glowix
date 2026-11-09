import { Text } from "react-native";

const AbcTest = ({ name, getData }) => {
  //   const { name } = props;
  const test = "Hello, World!";
  getData(test);
  return <Text>Welcome {name} !</Text>;
};
export default AbcTest;
