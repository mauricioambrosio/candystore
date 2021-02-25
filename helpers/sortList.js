// sort list based based on elements or based on a field
function sortList(list, reverse = false, field = undefined) {
  // return if list is undefined
  if (!list) return list;

  // create a list copy
  const newList = [...list];

  // call array sort method
  newList.sort((a, b) => {
    let aField;
    let bField;

    // if field is defined, sort based on field
    if (field) {

      // get field values. if values are string, convert them to lower case
      aField = typeof(a[field]) === "string" ? a[field].toLowerCase() : a[field];
      bField = typeof(b[field]) === "string" ? b[field].toLowerCase() : b[field];
    
    // else, sort based on elements
    } else {
      // get elemets. if they are string, convert them to lower case
      aField = typeof(a) === "string" ? a.toLowerCase() : a;
      bField = typeof(b) === "string" ? b.toLowerCase() : b;
    }

    // sorting rules if reverse
    if (reverse){
      if (aField < bField) return 1;
      if (aField > bField) return -1;
      return 0;
    }
    // sorting rules if not reverse
    else{
      if (aField < bField) return -1;
      if (aField > bField) return 1;
      return 0;
    }
  });
  return newList;
}

module.exports = sortList;
