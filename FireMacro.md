## FireMacro

FireMacro began as a simple macro syntax for merging text with values from our database.
It is now used throughout the system and developed a rich set of features enabling us to templatize much of
our business and configuration data.

It takes a dataset and  target. Any strings in curly braces are searched against the data set,
using dot notation and replaced if there is a match. The modified object is returned.

For example, if the target is "my client is {name}" and the dataset is a partner object, the result
might be "my client is Acme Corp".

In most cases the dataset is a collection of objects in which case one references the object type
and then the attribute, such as {client.name}.

If the target is an object rather than a simple string, FireMacro will recurse through objects and
arrays seeking strings to parse. A new object is returned. Both object attribute names
and values may contain macros references, such us {"{name}":"{value}"}.

## Usage

You must have access to geist's private module repository on npmjs.com
```
npm i @geistm/firemacro
```

```
let FireMacro = require("@geistm/firemacro");

let result = await new FireMacro("my name is {name}").parse({name:"michael"});
// result = my name is michael

let template = new FireMacro({name:"{name}",created:new Date()}) 
let result = await template.parse({name:"michael"});
// result = {name:"michael",date:dateObject}

let target = "<html><p>{person.name}<p>{person.email|no email}</html>"
let data = {
    person:{
        name:"michael",
        location:"New York"
    }
};
let result = await new FireMacro(target).parse(data);
// result = <html><p>michael<p>no email</html>
```

The pipe `|` in a macro sets up a default if the value doesn't exist. The
string after the pipe can be another macro. If it's empty, `{name|}`, the
default is "". If it's "null", {name|null}, it returns a literal javascript null.

NOTE: firemacro parse() is asynchronous in order to handle inline data requests.

### Iteration with $EACH

`$EACH` can be used as a special directive to iterate through the data set.
A long form is provided for when the data to iterate is provided directly
rather than contextually.

short form:
```
const template = new Firetext({
    company: "GeistM",
    people: {"$EACH": "{name}|{_id}"}
});
const result = template.parse([
    {name: "Michael", _id: "MS"},
    {name: "Alper", _id: "AD"}
]);
// result = {company:"GeistM",people:["Michael|MS","Alper"|"AD"]}
```

long form:
```
const template = new Firetext({
    company: "GeistM",
    people: {"$EACH": {data:"{people}",template:"{name}|{_id}"}}
});
const result = template.parse({
    people:[
        {name: "Michael", _id: "MS"},
        {name: "Alper", _id: "AD"}
    ]
});
// result = {company:"GeistM",people:["Michael|MS","Alper"|"AD"]}
```
Data can be provided explicitly as well

```
const template = new Firetext({
    company: "GeistM",
    people: {"$EACH": {data:["Michael","Alper"],template:"{$value.{}}"}
});
// result = {company:"GeistM",people:["Michael","Alper"]}
```

... or data can be referenced directly as a constant array.
```
const template = new Firetext({
    company: "GeistM",
    people: {"$EACH": {data:[
        {name: "Michael", _id: "MS"},
        {name: "Alper", _id: "AD"}
    ],template:"{name}|{_id}"}}
});
// result = {company:"GeistM",people:["Michael|MS","Alper"|"AD"]}
```

... or fetched from the given _datasource_. The syntax for the _data_
attribute of $EACH is the same as the syntax for _$DATA_.
```
const template = new Firetext({
    company: "GeistM",
    people: {"$EACH": {data:"/data/users",template:"{name}|{_id}"}}
});
// result = {company:"GeistM",people:["Michael|MS","Alper"|"AD"]}
```
$EACH blocks can be nested. If the result of the applied template is
an array, the results are concatenated to the result set rather than
pushed.
```
"$EACH":{
    "data":"/data/classic_stats/?where={parentId:ObjectId({_id})}&days=10",
    "template":{
        "$EACH":{
            "data":[{"metric":"cost"},{"metric":"cpa"}],
            "template":{
                "_id":"classic_{date.YYYY-MM-DD}_FB_{metric}",
                "day":"{date.YYYY-MM-DD}",
                "name":"{metric}",
                "value":"{FB.{metric}}"
            }
        }
    }
}
// result:
[
  {
    "_id": "classic_2019-07-08_BF_land",
    "day": "2019-07-08",
    "name": "land",
    "value": 478
  },
  {
    "_id": "classic_2019-07-08_BF_conv",
    "day": "2019-07-08",
    "name": "conv",
    "value": 17
  },
  {
    "_id": "classic_2019-07-09_BF_land",
    "day": "2019-07-09",
    "name": "land",
    "value": 426
  },
  {
    "_id": "classic_2019-07-09_BF_conv",
    "day": "2019-07-09",
    "name": "conv",
    "value": 15
  }
]
```

### $REDUCE

Whereas $EACH is like forEach() in javscript, $REDUCE is like reduce(). Provide
a data source with "path", or "data". 'path' expects the name of an iterable
attribute in the dataset, 'data' expects a url that returns an array or an array
constant. Result establishes the initial value. The default is an empty string, "".

If template is not specified, the value of $REDUCE is assumed to be the template
and the current data on the top of the data stack for the macro is expected to be
an array.

In the template, `{result}` references the current value of result. The result
of parsing the template is assigned to `{result}` on each iteration.

```
const macro = {
    $REDUCE:{
        data:[{a:3,b:6},{a:4,b:7},{a:5,b:8}],
        result:0,
        template:"{$math.add.{result}.{a}}"
    }
}
const ft = new Firetext(macro).parse({});
// result is 12
```

### $MAP
Map can be used to recast the members of an array.
```
const ft = new Firetext({
    $MAP:"{name}s"
})
ft.parse([
    {name:'red'},
    {name:'blue'}
]);
// result is ['reds','blues']
```

### $JSON and $ASSIGN
$JSON takes a string value, parses it into an object and assigns it to the
parent object. $ASSIGN takes an object value and assigns to the parent object.
If the value of $ASSIGN is an array, it assigns each element of the array.

### $SLEEP

If needed to slow down processing, for $GET for example, use $SLEEP. It's
a call to setTimeout((),value)

```
$SLEEP:"10000"
// stop processing for 10 seconds
```

### Pipeline results with $PIPE

An attribute named `$PIPE` expects an array. Each object in the array will become
the dataset for the next object in the array. The final result is assigned to the
enclosing object replaces the $PIPE attribute.

```
{
    "$PIPE":[
        {"one":"two"},
        {"three":"{one}"},
        {"four":"{three}"}
    ]
}
// result is {"four":"two"}
```

### $CONCAT
$CONCAT takes and array of objects and/or arrays. These are concatenated using
Array.concat();

### Arrays and Objects as values
A macro value may refer to an array, for example `{colors}`. If the data defines
colors as ["red","green","blue"], the result is "red,green,blue". It's effectively
the same as applying `toString()` on the array, but after each array item is itself
parsed as FireMacro

The macro value may reference an object, in which case it will be flattened into
query string format. All attribute values will be recursively parsed as FireMacro as well

```
let data = {
    colors:{
        "red":"#F00",
        "green":"#0F0",
        "blue":"#00F"
    }
};
let result = await new FireMacro("{colors}").parse(data);
// result = red=#F00&green=#0F0&blue=#00F
```

When an array of name:value pairs is the parent data field, the result is a lookup on `name`

```
let data = {
    colors:[
        {name:"red",value:"#F00"},
        {name:"green",value:"#0F0"},
        {name:"blue",value:"#00F"}
    ]
};
let result = await new FireMacro("{colors.green}").parse(data);
// result = "#0F0";
```

If a data value is a MongoDB *ObjectID* it is rendered to a string for convenience.

### Multiple Sources and $DATA

More than one data source can be passed into `parse()`. In this case they
are processed against the target in order.

Within an object template, an attribute named `$DATA` can push another dataset
on the stack and influence subsequent values until the data is "popped" when the
object parse completes.


If a value to `$DATA` is a string it is passed to the provided DataSource handler. If it
is an array or object, it is pushed on to the stack as given.

An attribute named `data` is treated the same as `$DATA` but is deprecated.

### $GET

$GET is an alias for $DATA and now the preferred form. $DATA is deprecated

### $TRYGET

$TRYGET is the same as $GET, but enclosed in a try catch block so it
won't error out. If the $GET request throws an error, no action is
taken, the parser continues.

### Macro Recursion
Everything in FireMacro is recursive. The string inside a macro is parsed for
macros as well. This way we can build up dynamic values
```
{codes.{network.shortname}_ID}
```
{network.shortname} gets replaced before the outer macro is processed, perhaps
resulting in {codes.FB_ID}

To avoid recursive parsing of object values which are themselves macro text
that should be left untouched, use $VALUE.

### $VALUE for data type protection

$VALUE provides more control over the value requested and avoids recursive
parsing. Instead of `myattr:{script}` you
can use `myattr:{$VALUE:'script'}`. If the `script` value contains macros
they will be left alone.

$VALUE can also take an object with attributes for _name_, _default_ and _type_.
The values of these attributes are put the macro parsing, but not the value of
the identified data.

Name is the name of the attribute in the data set, default is the value to use
if not found and type can used to cast the value as integer, float, string, date
or array. Array casting only works on strings of comma separated items.
Default and type are optional.

```
$VALUE:{
    name:"attribute_{qualifer},
    type:"integer",
    default:0
}
```

See also the helper `$value`.

### Conditions with $IF

$IF expects an object with a condition, a positive resolution and optionally
and negative resolution. The only condition current supported is equality, *eq*
(following Mongo naming conventions). The condition should be an array where
all values are equal, or a value that is true if not undefined and true.

```
const macro = {
    val1:{$IF:{eq:[2,2],then:true,else:false}},
    val2:{$IF:{eq:[2,3],then:true,else:false}},
    val3:{$IF:{eq:["{xyz}","xyz"],then:true,else:false}}
};
result = await new Firetext(macro).parse({});
// result = {val1:true,val2:false,val3:false}
```

### $SORT

$SORT expects one or more fields referencing attribute names in an
array of objects, e.g. "name,age". decorate the field mongo-style to
change sort order, e.g. "name,age:-1"

```
const macro = {
    $SORT:"name,num"
};
result = await new Firetext(macro).parse([
    {name:"zoe",num:3},{name:"may",num:5},{name:"abe", num:3},{name:"abe", num:1}
]);
// result
[
    {name:"abe",num:1},{name:"abe",num:3},{name:"may", num:5},{name:"zoe", num:3}
]
```

### $LOG

$LOG will invoke the log() method of the DataSource assigned when the macro
object is constructed. It expects a _message_ and a _level_. If a simple
string is provided, message is assigned this string and level is set to "info".

$LOG objects are removed from the result and produce no data of their own.

```
$LOG:{level:"warning",message:"trouble"}

$LOG:"info message"
```

`$log` can be used in a macro string as well. It takes to required
parameters, severity and message

```
log1:"{$log.info.hello}"
```

If you pass a function named `$log` in the data arguments to parse it
will override the default log function. The default looks first for a
Datasource log method and if not found, writes to console.log

### $COUNT

$COUNT can be used to fire info info log messages periodically. It is useful for
providing feedback when iterating over large data sets. It expects _threshold_
and _log_. This can be defined as object attributes or the shorthand,
"threshold:message".

The current count is added to the datastack before processing message.

```
$COUNT:"10:records processed {count}"
```

This results in a "records processed X" being sent to the DataSource log
method as DataSource.log.info(message) every tenth iteration.

### Data Functions

The data object can contain custom parsers. If a macro references an attribute
in the data source that is a function, this function is executed and the result
replaces the macro text. If there are dot delimited attribute names in the
macro that follow the function reference, they are provided as parameters
to the function, i.e. `{func.arg1.arg2}`.

This can be particularly useful when applied with recursive macros

```
let data = {
   name:"michael",
   uppercase: function(name) {
      return name.toUpperCase()
   }
}
let result = await new FireMacro("{uppercase.foobar}").parse(data);
// result = "FOOBAR"

let result = await new FireMacro("{uppercase.{name}}").parse(data);
// result = "MICHAEL"
```

### clear()

`FireMacro.clear()` will remove all remaining macros from the target
replacing them with empty strings.

## Helpers

There a few builtin helper functions used for common transformations. By
default, all helpers start with '$'. Application of the helpers can by
suppressed by adding `noHelpers=true` to the FireMacro options.

### $math
_$math_ is a helper function which can used in macros to do basic
number manipulation. It supports, _add_, _subtract_, _multiple_ and _divide_.

It can be used for casting with _$math.as_, e.g. {$math.as.integer.(1.2)}. Cast as
supports "as.string", "as.integer" and "as.float". Float will strip a leading
currency character if found.

It also support _$math.as.currency_ and _$math.as.percent_.

It can be used for precision with _$math.precision, e.g. {$math.precision.2.(3.456)}
will render 3.46. This is much the same as _$math.as.float.(3.456).2_.


```
{
    "$PIPE":[
        {val:"{$math.add.1.2}"},
        {val:"{$math.multiply.{val}.2}"},
        {val:"{$math.subtract.{val}.1}"},
        {val:"{$math.divide.{val}.2}"},
        {val:"{$math.round.({val})}"}
    ]
};
//resolve to 3 (Math.round(2.5) = 3

### parentheses for dot preservation
```
Use parentheses to preserve the dots in a floating point number.
```
{
    "$PIPE":[
        {val:2.5},
        {val:"{$math.multiply.({val}).(2.1)}"}
    ]
}
```

### $date
_$date_ provides date manipulation to and from strings as well
as basic date math

```
{$date.[source][.method][.value][.targetPattern}
```
Source is the string or date object. Use "now" to get the current
date time.
If targetPattern is provided the date result is transformed
into a formatted string.

Methods:

* to: value assumes the role of targetPattern
* from: value is the pattern by which to parse the date
* add: value adds to source using shortform moment syntax,
  eg. 1d, 4w, 3h, etc
* subtract: value subtracts from the source using shortform
  moment syntax.

Where data input is `{dt:moment("20191014").toDate(),txt:"20191014"}`
```
d1:"{$date.{dt}}",
d2:"{$date.{txt}.from.YYYYMMDD}",
d3:"{$date.{dt}.to.YYYYMMDD}",
d4:"{$date.{txt}.from.YYYYMMDD.YYYY-MM-DD}"

d5:"{$date.now.to.M}",
d6:"{$date.{dt}.add.2d}",
d7:"{$date.{dt}.subtract.1w.YYYYMMDD}",
d8:"{$date.{txt}.add.10d}"
``` 

### $value
_$value_ can be used in macros to treat the given attribute as
a macro name itself

```
const macro = {
    val:"{$value.{attribute}}"
};
const ft = new Firetext(macro).parse({attribute:"data",data:3});
// result is 3
```

If no attribute name is specified then $value is replaced with the
the object on top of the data stack

```
const macro = {
    val:"{$value.}"
};
const ft = new Firetext(macro).parse({a:"hello"});
// result is {val:{a:"hello"}}
```

